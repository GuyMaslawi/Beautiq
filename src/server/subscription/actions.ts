"use server";

import { randomUUID } from "crypto";
import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";
import { planPriceMinor, confirmSubscriptionPayment } from "@/server/subscription/service";
import { isGrowConfigured, createPaymentLink, cancelDirectDebit } from "@/lib/subscription/grow";
import { PLANS } from "@/lib/plans";
import { logger, captureError } from "@/lib/logger";

/**
 * Self-serve subscription checkout (see CLAUDE.md §13, [[project_subscribe_paywall]]).
 *
 * The owner pays Allura for their monthly plan on Grow's (Meshulam) SECURE
 * hosted page — Allura never handles card details. This action creates the Grow
 * payment process and returns the hosted URL to redirect to; the plan is only
 * actually activated once a payment is CONFIRMED server-side (the Grow webhook
 * or the return route), never from this call.
 *
 * When Grow is not configured (dev / tests) we fall back to an instant local
 * activation so the app stays runnable without an external service.
 */

export interface CheckoutResult {
  ok: boolean;
  /** Where the client should navigate: Grow's hosted page, or an internal path. */
  redirectUrl?: string;
  error?: string;
}

function parsePlan(value: unknown): AccountPlan | null {
  if (value === AccountPlan.premium || value === AccountPlan.platinum) return value;
  return null;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Start checkout for the chosen plan. Handles both the signup paywall and the
 * Premium→Platinum upgrade (any target plan that differs from the current one).
 * `planId` is validated server-side — never trust the client to name a plan.
 */
export async function startSubscriptionCheckoutAction(
  planId: string,
): Promise<CheckoutResult> {
  const user = await requireCurrentUser();

  const plan = parsePlan(planId);
  if (!plan) {
    return { ok: false, error: "בחירת תוכנית לא תקינה. נסי שוב." };
  }

  // Already on this exact plan — nothing to charge.
  if (user.plan === plan) {
    return { ok: true, redirectUrl: "/dashboard" };
  }

  const priceMinor = planPriceMinor(plan);
  const nonce = randomUUID();

  // Reset the (single) subscription row to a fresh pending checkout for this plan.
  const subscription = await prisma.accountSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan,
      priceMinor,
      status: AccountSubscriptionStatus.pending,
      checkoutNonce: nonce,
    },
    update: {
      plan,
      priceMinor,
      status: AccountSubscriptionStatus.pending,
      checkoutNonce: nonce,
      processId: null,
      processToken: null,
    },
  });

  // ── Dev / unconfigured fallback: activate immediately, no external charge. ──
  if (!isGrowConfigured()) {
    await confirmSubscriptionPayment(subscription, {});
    return { ok: true, redirectUrl: "/dashboard" };
  }

  // ── Real Grow hosted checkout (payment link brokered via Make) ─────────────
  try {
    const base = appBaseUrl();
    const { paymentUrl, processId, processToken } = await createPaymentLink({
      amountMinor: priceMinor,
      description: `מנוי ${PLANS[plan].name} — Allura`,
      fullName: user.name ?? user.email.split("@")[0],
      phone: "",
      email: user.email,
      successUrl: `${base}/api/subscription/return?sid=${subscription.id}`,
      notifyUrl: `${base}/api/subscription/webhook`,
      nonce,
      userId: user.id,
      plan,
    });

    await prisma.accountSubscription.update({
      where: { id: subscription.id },
      data: { processId, processToken },
    });

    logger.info("[subscription.checkout] Grow process created", {
      userId: user.id,
      plan,
      processId,
    });

    return { ok: true, redirectUrl: paymentUrl };
  } catch (err) {
    captureError("subscription.checkout", err, { userId: user.id, plan });
    return { ok: false, error: "אירעה תקלה בפתיחת עמוד התשלום. נסי שוב." };
  }
}

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Cancel the current subscription. Access continues until the end of the paid
 * period (we keep `User.plan` set); the daily sweep closes the gate once the
 * period ends. Best-effort asks Grow to stop the monthly direct debit — if that
 * is not wired through Make, the standing order is stopped manually from Grow's
 * merchant dashboard, but no further access is granted past the period regardless.
 */
export async function cancelSubscriptionAction(): Promise<CancelResult> {
  const user = await requireCurrentUser();

  const sub = await prisma.accountSubscription.findUnique({ where: { userId: user.id } });
  if (!sub) return { ok: false, error: "לא נמצא מנוי פעיל לביטול." };
  if (
    sub.status !== AccountSubscriptionStatus.active &&
    sub.status !== AccountSubscriptionStatus.past_due
  ) {
    return { ok: true }; // already cancelled/expired — nothing to do.
  }

  try {
    await prisma.accountSubscription.update({
      where: { id: sub.id },
      data: { status: AccountSubscriptionStatus.cancelled, cancelledAt: new Date() },
    });
  } catch (err) {
    captureError("subscription.cancel", err, { userId: user.id });
    return { ok: false, error: "אירעה תקלה בביטול המנוי. נסי שוב." };
  }

  // Best-effort: stop the recurring charge at Grow.
  if (sub.directDebitId) {
    const stopped = await cancelDirectDebit(sub.directDebitId);
    logger.info("[subscription.cancel] cancelled", {
      userId: user.id,
      directDebitStopped: stopped,
    });
  }

  return { ok: true };
}
