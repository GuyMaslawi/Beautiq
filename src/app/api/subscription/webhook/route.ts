/**
 * Grow (Meshulam) server-to-server notification for Allura subscriptions.
 *
 *   POST /api/subscription/webhook
 *
 * This is the SOURCE OF TRUTH for activating a paid plan — never a browser
 * redirect. Grow POSTs here directly (the notifyUrl we passed when the payment
 * link was created), both for the first charge and for every automatic monthly
 * direct-debit (הוראת קבע) run. Flow:
 *   1. parse Grow's callback (JSON or form-encoded `data[...]`),
 *   2. locate our subscription — by processId (first charge) or directDebitId
 *      (recurring run),
 *   3. authenticate it (first charge: processToken + our nonce must match),
 *   4. approved → activate / extend the plan (idempotently); a failed recurring
 *      run → past_due, then lapse after the grace window,
 *   5. acknowledge back to Grow (best-effort, via the optional Make approve webhook).
 */

import { NextResponse } from "next/server";
import { AccountSubscriptionStatus, type AccountSubscription } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { parseCallback, approveTransaction } from "@/lib/subscription/grow";
import { confirmSubscriptionPayment, markRenewalFailed } from "@/server/subscription/service";
import { secretEquals } from "@/lib/secret-compare";
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Parse a Grow callback body into a `{ data: {...} }`-shaped record. */
function parseBody(raw: string, contentType: string): Record<string, unknown> {
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  // Form-encoded, possibly with bracketed keys like data[processId]=...
  const params = new URLSearchParams(raw);
  const flat: Record<string, unknown> = {};
  const nested: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    const m = key.match(/^data\[(.+)\]$/);
    if (m) nested[m[1]] = value;
    else flat[key] = value;
  }
  if (Object.keys(nested).length > 0) return { ...flat, data: nested };
  return flat;
}

/**
 * The endpoint secret every notification must present.
 *
 * Grow itself signs nothing, so the sender is authenticated with a secret we
 * embed in the notifyUrl when the payment link is created (`?t=<secret>`) — Grow
 * POSTs back to exactly that URL, so no Make-scenario change is needed. A header
 * is also accepted for scenarios that prefer to send one explicitly.
 *
 * Fails CLOSED: with no secret configured every notification is rejected, and
 * checkEnv() makes the variable a hard startup error whenever SUBSCRIPTIONS_ENABLED
 * is on, so a misconfiguration surfaces at boot rather than as silent free access.
 */
function isAuthenticSender(req: Request): boolean {
  const secret = process.env.SUBSCRIPTION_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  // Read the query via the standard URL API rather than `nextUrl`, so the check
  // behaves identically for any Request shape reaching this handler.
  let token: string | null = null;
  try {
    token = new URL(req.url).searchParams.get("t");
  } catch {
    token = null;
  }

  return (
    secretEquals(token, secret) ||
    secretEquals(req.headers.get("x-allura-webhook-secret"), secret)
  );
}

export async function POST(req: Request) {
  // ── Gate 1: authenticate the SENDER, for every notification type ───────────
  // Without this, anyone who learns or guesses a Grow directDebitId can POST a
  // forged "paid" renewal (free plan forever) or a forged "failed" one (lapsing
  // a paying customer). The per-transaction processToken check below only ever
  // covered the FIRST charge, leaving every recurring run unauthenticated.
  if (!isAuthenticSender(req)) {
    logger.warn("[subscription.webhook] rejected — sender not authenticated");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  const event = parseCallback(parseBody(rawBody, contentType));
  if (!event) {
    logger.warn("[subscription.webhook] unparseable callback");
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Locate the subscription: first charge carries our processId; automatic
  // monthly runs carry only the direct-debit id.
  let subscription: AccountSubscription | null = null;
  let matchedByProcess = false;
  if (event.processId) {
    subscription = await prisma.accountSubscription.findFirst({
      where: { processId: event.processId },
    });
    matchedByProcess = !!subscription;
  }
  if (!subscription && event.directDebitId) {
    subscription = await prisma.accountSubscription.findFirst({
      where: { directDebitId: event.directDebitId },
    });
  }

  if (!subscription) {
    // Ack so Grow does not retry a notification we cannot match.
    logger.warn("[subscription.webhook] no subscription for notification", {
      processId: event.processId,
      directDebitId: event.directDebitId,
    });
    return new NextResponse("OK", { status: 200 });
  }

  // Authenticate the first charge with the process token — a per-transaction
  // secret Grow returned to us at creation and echoes back here. The optional
  // nonce (cField1) is a bonus check when present, but the token alone is
  // sufficient, so a scenario that does not round-trip cField1 still works.
  if (matchedByProcess) {
    const tokenOk = secretEquals(subscription.processToken, event.processToken);
    const nonceMismatch =
      !!subscription.checkoutNonce &&
      !!event.nonce &&
      !secretEquals(subscription.checkoutNonce, event.nonce);
    if (!tokenOk || nonceMismatch) {
      logger.warn("[subscription.webhook] authentication failed", {
        processId: event.processId,
        tokenOk,
        nonceMismatch,
      });
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // A cancelled/expired subscription must never be revived — not by a late
  // recurring charge (Grow ran the standing order once more before it was
  // stopped) and not by anything else. This deliberately does NOT depend on
  // `event.isRecurringRun`: that flag is derived from attacker-controllable body
  // fields (paymentSource/paymentType), so gating on it let a crafted callback
  // that simply omitted them resurrect a dead subscription.
  if (
    subscription.status === AccountSubscriptionStatus.cancelled ||
    subscription.status === AccountSubscriptionStatus.expired
  ) {
    logger.warn("[subscription.webhook] charge on cancelled/expired sub — ignored", {
      subscriptionId: subscription.id,
      status: subscription.status,
      recurring: event.isRecurringRun,
    });
    return new NextResponse("OK", { status: 200 });
  }

  // The charge must be for the price we actually authorized. Without this, a
  // standing order left running at the OLD plan's price (e.g. ₪149 Premium)
  // activates whatever plan the row currently names (₪249 Platinum) — paid
  // features at the cheaper price, renewing every month.
  if (event.sumMinor !== undefined && event.sumMinor !== subscription.priceMinor) {
    logger.warn("[subscription.webhook] amount mismatch — ignored", {
      subscriptionId: subscription.id,
      expected: subscription.priceMinor,
      received: event.sumMinor,
    });
    return new NextResponse("OK", { status: 200 });
  }

  if (!event.paid) {
    // A failed automatic renewal lapses the sub after the grace window; a failed
    // first charge just leaves it pending (the owner can retry checkout).
    if (!matchedByProcess || event.isRecurringRun) {
      const { lapsed } = await markRenewalFailed(
        subscription,
        `direct debit not approved (status ${event.statusCode ?? "?"})`,
      );
      logger.info("[subscription.webhook] renewal charge failed", {
        subscriptionId: subscription.id,
        lapsed,
      });
    } else {
      logger.info("[subscription.webhook] first charge not approved — left pending", {
        subscriptionId: subscription.id,
        statusCode: event.statusCode,
      });
    }
    return new NextResponse("OK", { status: 200 });
  }

  try {
    const { alreadyApplied } = await confirmSubscriptionPayment(subscription, {
      transactionId: event.transactionId,
      directDebitId: event.directDebitId,
      cardSuffix: event.cardSuffix,
    });
    logger.info("[subscription.webhook] payment confirmed", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      recurring: event.isRecurringRun,
      alreadyApplied,
    });
  } catch (err) {
    captureError("subscription.webhook", err, { subscriptionId: subscription.id });
    // 500 → Grow retries; confirmation is idempotent so that is safe.
    return new NextResponse("Error", { status: 500 });
  }

  // Acknowledge receipt to Grow (best-effort — never blocks activation).
  if (event.processId && subscription.processToken) {
    await approveTransaction({
      processId: event.processId,
      processToken: subscription.processToken,
      transactionId: event.transactionId,
    });
  }

  return new NextResponse("OK", { status: 200 });
}
