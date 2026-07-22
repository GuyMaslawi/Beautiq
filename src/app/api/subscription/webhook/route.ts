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

import { NextResponse, type NextRequest } from "next/server";
import { AccountSubscriptionStatus, type AccountSubscription } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { parseCallback, approveTransaction } from "@/lib/subscription/grow";
import { confirmSubscriptionPayment, markRenewalFailed } from "@/server/subscription/service";
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

/** Timing-safe-ish equality for short secrets. */
function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
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
    const tokenOk = safeEqual(subscription.processToken, event.processToken);
    const nonceMismatch =
      !!subscription.checkoutNonce && !!event.nonce && !safeEqual(subscription.checkoutNonce, event.nonce);
    if (!tokenOk || nonceMismatch) {
      logger.warn("[subscription.webhook] authentication failed", {
        processId: event.processId,
        tokenOk,
        nonceMismatch,
      });
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // A cancelled/expired subscription must never be revived by a late recurring
  // charge (e.g. Grow ran the standing order once more before it was stopped).
  if (
    event.isRecurringRun &&
    (subscription.status === AccountSubscriptionStatus.cancelled ||
      subscription.status === AccountSubscriptionStatus.expired)
  ) {
    logger.warn("[subscription.webhook] recurring charge on cancelled/expired sub — ignored", {
      subscriptionId: subscription.id,
      status: subscription.status,
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
