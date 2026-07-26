"use server";

import { randomUUID } from "crypto";
import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";
import { planPriceMinor, confirmSubscriptionPayment } from "@/server/subscription/service";
import { isGrowConfigured, createPaymentLink, cancelDirectDebit } from "@/lib/subscription/grow";
import { PLANS } from "@/lib/plans";
import { SUPPORT_EMAIL } from "@/lib/config";
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
 * Paying is mandatory: EVERY business owner pays the full plan price. There are
 * exactly two ways `User.plan` is ever set — a payment confirmed server-side by
 * Grow (confirmSubscriptionPayment), or a deliberate admin grant
 * (adminSetAccountPlanAction). A signed-up owner who has not paid simply has no
 * plan and sits behind the /subscribe gate, which is the only "free" state.
 *
 * Outside production (dev / tests) an instant local activation keeps the app
 * runnable without Grow. That shortcut is hard-blocked in production — see
 * assertCheckoutAvailable below.
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
 * In production, refuse to run checkout at all unless real Grow billing is wired.
 *
 * Without this, a missing `SUBSCRIPTIONS_ENABLED` / `MAKE_GROW_CREATE_LINK_WEBHOOK_URL`
 * in the deployment silently turned the paywall into a giveaway: the dev shortcut
 * below activated a full Premium/Platinum plan for anyone who clicked, with no
 * charge and nothing in the logs to notice. Free access must be a decision the
 * admin makes per account, never a side effect of configuration.
 *
 * Checked BEFORE any write, because the code below resets the subscription row
 * (clearing `directDebitId`) — bailing out afterwards would cut an existing
 * paying customer loose from her live standing order.
 */
function assertCheckoutAvailable(): string | null {
  if (isGrowConfigured()) return null;
  if (process.env.NODE_ENV !== "production") return null;
  return (
    "התשלום אינו זמין כרגע ולכן לא ניתן להפעיל את המנוי. " +
    `נסי שוב בעוד מספר דקות, ואם התקלה חוזרת פני אלינו ב-${SUPPORT_EMAIL}.`
  );
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

  const unavailable = assertCheckoutAvailable();
  if (unavailable) {
    logger.error(
      "[subscription.checkout] blocked — billing is not configured in production. " +
        "Set SUBSCRIPTIONS_ENABLED=true and MAKE_GROW_CREATE_LINK_WEBHOOK_URL. " +
        "No plan was granted.",
      { userId: user.id, plan },
    );
    return { ok: false, error: unavailable };
  }

  // Capture the current standing order (if any) before we overwrite the row —
  // switching plans re-authorizes at the NEW price, and Grow can't change a live
  // direct debit's amount, so the old one must be stopped to avoid double billing.
  const previous = await prisma.accountSubscription.findUnique({
    where: { userId: user.id },
    select: { directDebitId: true, status: true },
  });

  // Already on this exact plan AND billing is authorized (active) — nothing to
  // charge. A `pending` sub on the same plan is a re-authorization (e.g. after an
  // admin plan change, or an abandoned switch), so it must proceed to checkout.
  if (
    user.plan === plan &&
    previous?.status === AccountSubscriptionStatus.active
  ) {
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
      // A new plan means a NEW authorization at a new price. Keeping the old
      // standing-order id let the previous plan's cheaper monthly charge come
      // back and activate the more expensive plan (the old direct debit is only
      // stopped best-effort, below), so it must not survive the switch.
      directDebitId: null,
    },
  });

  // ── Dev / test only: activate immediately, no external charge. ─────────────
  // Unreachable in production — assertCheckoutAvailable() returned above.
  if (!isGrowConfigured()) {
    await confirmSubscriptionPayment(subscription, {});
    return { ok: true, redirectUrl: "/dashboard" };
  }

  // ── Real Grow hosted checkout (payment link brokered via Make) ─────────────
  try {
    // Stop the previous monthly standing order (best-effort) — the new plan is
    // charged on a fresh direct debit at its own price.
    if (previous?.directDebitId) {
      const stopped = await cancelDirectDebit(previous.directDebitId);
      logger.info("[subscription.checkout] previous direct debit stop requested", {
        userId: user.id,
        stopped,
      });
    }

    const base = appBaseUrl();
    // Grow signs nothing, so the notifyUrl carries our endpoint secret: Grow
    // POSTs back to exactly this URL, which lets the webhook authenticate the
    // sender on EVERY notification (including the automatic monthly runs, which
    // carry no processToken). See src/app/api/subscription/webhook/route.ts.
    const webhookSecret = process.env.SUBSCRIPTION_WEBHOOK_SECRET?.trim();
    const notifyUrl = webhookSecret
      ? `${base}/api/subscription/webhook?t=${encodeURIComponent(webhookSecret)}`
      : `${base}/api/subscription/webhook`;

    const { paymentUrl, processId, processToken } = await createPaymentLink({
      amountMinor: priceMinor,
      description: `מנוי ${PLANS[plan].name} — Allura`,
      fullName: user.name ?? user.email.split("@")[0],
      phone: "",
      email: user.email,
      successUrl: `${base}/api/subscription/return`,
      notifyUrl,
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
