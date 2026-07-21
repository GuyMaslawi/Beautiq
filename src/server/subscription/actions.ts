"use server";

import { randomUUID } from "crypto";
import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";
import { planPriceMinor, confirmSubscriptionPayment } from "@/server/subscription/service";
import { isGrowConfigured, createPaymentProcess } from "@/lib/subscription/grow";
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

  // ── Real Grow hosted checkout ──────────────────────────────────────────────
  try {
    const base = appBaseUrl();
    const { paymentUrl, processId, processToken } = await createPaymentProcess({
      amountMinor: priceMinor,
      description: `מנוי ${PLANS[plan].name} — Allura`,
      fullName: user.name ?? user.email.split("@")[0],
      phone: "",
      email: user.email,
      successUrl: `${base}/api/subscription/return?sid=${subscription.id}`,
      cancelUrl: `${base}/subscribe?canceled=1`,
      notifyUrl: `${base}/api/subscription/webhook`,
      nonce,
      cField2: user.id,
      cField3: plan,
      saveCardToken: true,
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
