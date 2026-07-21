/**
 * Subscription domain service.
 *
 * The single place that flips an AccountSubscription (and the mirrored
 * `User.plan` gate flag) between states. Shared by the Grow webhook, the
 * browser-return route, and the monthly-renewal cron so activation is
 * consistent and idempotent no matter which one confirms the payment first.
 *
 * `User.plan` is the fast flag the app gate reads: it is set ONLY here, once a
 * payment is confirmed, and cleared here when the subscription lapses — so the
 * gate can never open on an unpaid account.
 *
 * Server-only.
 */

import { AccountPlan, AccountSubscriptionStatus, type AccountSubscription } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { encryptSecret } from "@/lib/payments/crypto";
import { PLAN_PRICES, type PlanId } from "@/lib/plans";

/** Days of continued access after a failed renewal before the account lapses. */
export const RENEWAL_GRACE_DAYS = 3;

/** Authoritative monthly price for a plan, in agorot (₪1 = 100). */
export function planPriceMinor(plan: AccountPlan): number {
  return PLAN_PRICES[plan as PlanId] * 100;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export interface ConfirmedPayment {
  /** Grow transaction id of the successful charge (globally unique). */
  transactionId?: string;
  /** Reusable Grow card token for future renewals (stored encrypted). */
  cardToken?: string;
  cardSuffix?: string;
}

/**
 * Record a confirmed payment against a subscription and open access. Handles
 * both the first payment and monthly renewals; idempotent on transactionId, so
 * a webhook and the return route racing on the same charge is safe.
 *
 * Extends the billing period by one month from the later of now / the current
 * period end, sets the subscription `active`, and mirrors the plan onto the user.
 */
export async function confirmSubscriptionPayment(
  subscription: Pick<
    AccountSubscription,
    "id" | "userId" | "plan" | "providerTransactionId" | "currentPeriodEnd" | "activatedAt"
  >,
  payment: ConfirmedPayment,
): Promise<{ alreadyApplied: boolean }> {
  // Idempotency: this exact charge was already applied.
  if (
    payment.transactionId &&
    subscription.providerTransactionId === payment.transactionId
  ) {
    return { alreadyApplied: true };
  }

  const now = new Date();
  const base =
    subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
      ? subscription.currentPeriodEnd
      : now;
  const periodEnd = addMonths(base, 1);

  await prisma.$transaction([
    prisma.accountSubscription.update({
      where: { id: subscription.id },
      data: {
        status: AccountSubscriptionStatus.active,
        activatedAt: subscription.activatedAt ?? now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        lastChargeAt: now,
        lastFailureReason: null,
        ...(payment.transactionId ? { providerTransactionId: payment.transactionId } : {}),
        ...(payment.cardToken ? { cardTokenEncrypted: encryptSecret(payment.cardToken) } : {}),
        ...(payment.cardSuffix ? { cardSuffix: payment.cardSuffix } : {}),
      },
    }),
    prisma.user.update({
      where: { id: subscription.userId },
      data: {
        plan: subscription.plan,
        planActivatedAt: subscription.activatedAt ?? now,
      },
    }),
  ]);

  return { alreadyApplied: false };
}

/**
 * A renewal charge failed. Keep access during the grace window (status
 * past_due); once the grace window is exhausted, lapse the subscription and
 * close the gate by clearing the user's plan.
 */
export async function markRenewalFailed(
  subscription: Pick<AccountSubscription, "id" | "userId" | "currentPeriodEnd">,
  reason: string,
): Promise<{ lapsed: boolean }> {
  const now = new Date();
  const graceEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd.getTime() + RENEWAL_GRACE_DAYS * 86_400_000)
    : now;

  if (now > graceEnd) {
    await prisma.$transaction([
      prisma.accountSubscription.update({
        where: { id: subscription.id },
        data: {
          status: AccountSubscriptionStatus.expired,
          lastFailureReason: reason.slice(0, 300),
        },
      }),
      prisma.user.update({
        where: { id: subscription.userId },
        data: { plan: null, planActivatedAt: null },
      }),
    ]);
    return { lapsed: true };
  }

  await prisma.accountSubscription.update({
    where: { id: subscription.id },
    data: {
      status: AccountSubscriptionStatus.past_due,
      lastFailureReason: reason.slice(0, 300),
    },
  });
  return { lapsed: false };
}
