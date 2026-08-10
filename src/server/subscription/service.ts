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

import {
  AccountPlan,
  AccountSubscriptionStatus,
  Prisma,
  type AccountSubscription,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { PLAN_PRICE } from "@/lib/plans";

/** Days of continued access after a failed renewal before the account lapses. */
export const RENEWAL_GRACE_DAYS = 3;

/**
 * Two confirmations this close together are the same charge reaching us twice,
 * not two payments. Wide enough to absorb a webhook retry hours later, far
 * narrower than the monthly cycle it must never swallow.
 */
export const DUPLICATE_CHARGE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * The list monthly price, in agorot (₪1 = 100). One plan means one price —
 * legacy `premium` / `platinum` rows are billed at it too.
 */
export function planPriceMinor(): number {
  return PLAN_PRICE * 100;
}

/** Bounds for an admin-set custom monthly price, in agorot. */
export const MIN_CUSTOM_PRICE_MINOR = 100; // ₪1 — Grow cannot bill ₪0.
export const MAX_CUSTOM_PRICE_MINOR = 1_000_000; // ₪10,000 — typo guard.

/**
 * What this owner actually pays each month, in agorot.
 *
 * An admin can negotiate a price per account (`User.customPriceMinor`); when set
 * it REPLACES the list price for every charge — the first checkout, an admin
 * access change, and each monthly renewal — until an admin changes or clears it.
 * Every place that decides an amount must go through here, otherwise a renewal
 * would quietly fall back to the list price.
 */
export function effectivePriceMinor(
  customPriceMinor: number | null | undefined,
): number {
  if (
    typeof customPriceMinor === "number" &&
    Number.isInteger(customPriceMinor) &&
    customPriceMinor >= MIN_CUSTOM_PRICE_MINOR &&
    customPriceMinor <= MAX_CUSTOM_PRICE_MINOR
  ) {
    return customPriceMinor;
  }
  return planPriceMinor();
}

/**
 * A subscription that is still `active` well past its own `currentPeriodEnd`.
 *
 * Grow charges the standing order and re-notifies our webhook, which extends the
 * period. So an active row whose period ended days ago means NO renewal
 * notification was ever processed: the standing order was stopped, the card died
 * and Grow gave up, or the callback never reached us (wrong URL, rejected
 * secret, a field name we do not parse). Nothing else in the system looks at
 * this — the daily sweep only handles `cancelled` and `past_due` — so such a row
 * keeps `User.plan` set and the owner keeps full access, for free, forever, with
 * nothing in the logs.
 */
function overdueRenewalFilter(now: Date) {
  return {
    status: AccountSubscriptionStatus.active,
    currentPeriodEnd: { lt: new Date(now.getTime() - RENEWAL_GRACE_DAYS * 86_400_000) },
  };
}

/** How many active subscriptions are past due a renewal we never saw. */
export async function countOverdueRenewals(now: Date): Promise<number> {
  return prisma.accountSubscription.count({ where: overdueRenewalFilter(now) });
}

/**
 * The overdue subscriptions themselves, oldest first, for the alert payload.
 *
 * Deliberately read-only: this does NOT revoke access. The recurring callback
 * has never been verified against a real Grow charge, so auto-expiring accounts
 * on its absence could cut off every paying customer in month two — a far worse
 * failure than the leak it would close. Surfacing it is the safe half; the
 * decision stays with a human.
 */
export async function findOverdueRenewals(now: Date, limit = 100) {
  return prisma.accountSubscription.findMany({
    where: overdueRenewalFilter(now),
    select: {
      id: true,
      userId: true,
      currentPeriodEnd: true,
      directDebitId: true,
      lastChargeAt: true,
      user: { select: { email: true } },
    },
    orderBy: { currentPeriodEnd: "asc" },
    take: limit,
  });
}

/**
 * Standing orders that are still live at Grow behind a subscription nobody has
 * access to any more.
 *
 * Grow's Make app cannot stop a recurring payment — the vendor says it has to be
 * done on the Grow site — so cancelling in Allura closes access and leaves the
 * direct debit charging the customer's card. That made the whole safety net one
 * email: miss it, and someone who cancelled keeps paying with nothing anywhere
 * to remind you. These rows are the open task list, and they stay open until an
 * admin confirms the standing order was stopped.
 */
const AWAITING_STOP_FILTER: Prisma.AccountSubscriptionWhereInput = {
  status: {
    in: [AccountSubscriptionStatus.cancelled, AccountSubscriptionStatus.expired],
  },
  directDebitId: { not: null },
  directDebitStoppedAt: null,
};

/** How many standing orders still need stopping by hand in Grow. */
export async function countDirectDebitsAwaitingStop(): Promise<number> {
  return prisma.accountSubscription.count({ where: AWAITING_STOP_FILTER });
}

/** The rows themselves — oldest cancellation first, since it bills the longest. */
export async function findDirectDebitsAwaitingStop(limit = 50) {
  return prisma.accountSubscription.findMany({
    where: AWAITING_STOP_FILTER,
    select: {
      id: true,
      status: true,
      directDebitId: true,
      priceMinor: true,
      cancelledAt: true,
      currentPeriodEnd: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { cancelledAt: "asc" },
    take: limit,
  });
}

/**
 * Record that the standing order was stopped in Grow. Idempotent, and refuses to
 * "stop" a subscription that is still live — marking an active one would hide a
 * paying customer's direct debit from the list that exists to catch it.
 */
export async function markDirectDebitStopped(subscriptionId: string): Promise<boolean> {
  const { count } = await prisma.accountSubscription.updateMany({
    where: { id: subscriptionId, ...AWAITING_STOP_FILTER },
    data: { directDebitStoppedAt: new Date() },
  });
  return count > 0;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export interface ConfirmedPayment {
  /** Grow transaction id of the successful charge (globally unique). */
  transactionId?: string;
  /** Grow direct-debit id (הוראת קבע) — links the monthly renewals to this sub. */
  directDebitId?: string;
  cardSuffix?: string;
  /** True when this came from Grow's automatic monthly run, not the first checkout. */
  isRecurring?: boolean;
}

/**
 * Append one row to the billing ledger. Never throws: a ledger write must never
 * fail a real payment — losing an audit row is bad, refusing a paid customer's
 * access is worse. The unique providerTransactionId absorbs webhook retries, so
 * a duplicate simply no-ops.
 */
async function recordCharge(data: {
  userId: string;
  subscriptionId: string;
  plan: AccountPlan;
  amountMinor: number;
  outcome: "paid" | "failed";
  transactionId?: string;
  directDebitId?: string;
  cardSuffix?: string;
  isRecurring?: boolean;
  failureReason?: string;
}): Promise<void> {
  try {
    await prisma.subscriptionCharge.create({
      data: {
        userId: data.userId,
        subscriptionId: data.subscriptionId,
        plan: data.plan,
        amountMinor: data.amountMinor,
        outcome: data.outcome,
        providerTransactionId: data.transactionId ?? null,
        directDebitId: data.directDebitId ?? null,
        cardSuffix: data.cardSuffix ?? null,
        isRecurring: data.isRecurring ?? false,
        failureReason: data.failureReason?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Duplicate transaction id (retry) or any transient write problem.
  }
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
    | "id"
    | "userId"
    | "plan"
    | "priceMinor"
    | "providerTransactionId"
    | "currentPeriodEnd"
    | "activatedAt"
    | "lastChargeAt"
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

  // The same charge reported twice under two DIFFERENT ids. Grow reaches this
  // endpoint over several channels and they do not agree on what a transaction
  // is called (`transactionId` on the payment-link callback, `transactionCode`
  // on the account-level webhook), so the id check above cannot catch it — and
  // the cost is a second free month, silently, on every payment. A subscription
  // billed monthly is never legitimately charged twice within hours; a fresh
  // checkout clears `lastChargeAt` so a re-authorization is not caught here.
  if (
    subscription.lastChargeAt &&
    now.getTime() - subscription.lastChargeAt.getTime() < DUPLICATE_CHARGE_WINDOW_MS
  ) {
    return { alreadyApplied: true };
  }
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
        ...(payment.directDebitId ? { directDebitId: payment.directDebitId } : {}),
        ...(payment.cardSuffix ? { cardSuffix: payment.cardSuffix } : {}),
      },
    }),
    prisma.user.update({
      where: { id: subscription.userId },
      data: {
        plan: subscription.plan,
        planActivatedAt: subscription.activatedAt ?? now,
        // A paid subscription never expires on a date — it renews. Clearing this
        // is what lets a FREE-TRIAL owner convert: her comped grant left a
        // `planExpiresAt`, and the gate treats a past expiry as "no plan" no
        // matter what `plan` says. Without this she would pay, be sent straight
        // back to /subscribe with no explanation, and pay again.
        planExpiresAt: null,
      },
    }),
  ]);

  await recordCharge({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    amountMinor: subscription.priceMinor,
    outcome: "paid",
    transactionId: payment.transactionId,
    directDebitId: payment.directDebitId,
    cardSuffix: payment.cardSuffix,
    isRecurring: payment.isRecurring,
  });

  return { alreadyApplied: false };
}

/**
 * A renewal charge failed. Keep access during the grace window (status
 * past_due); once the grace window is exhausted, lapse the subscription and
 * close the gate by clearing the user's plan.
 */
export async function markRenewalFailed(
  subscription: Pick<
    AccountSubscription,
    "id" | "userId" | "plan" | "priceMinor" | "currentPeriodEnd"
  >,
  reason: string,
): Promise<{ lapsed: boolean }> {
  const now = new Date();

  // A failed renewal previously left only `lastFailureReason`, which the NEXT
  // event overwrote — so a customer who failed twice and then paid looked like
  // she never had a problem. The ledger keeps every attempt.
  await recordCharge({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    amountMinor: subscription.priceMinor,
    outcome: "failed",
    isRecurring: true,
    failureReason: reason,
  });
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
