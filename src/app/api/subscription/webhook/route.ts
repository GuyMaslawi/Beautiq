/**
 * Grow (Meshulam) server-to-server notification for Allura subscriptions.
 *
 *   POST /api/subscription/webhook
 *
 * This is the SOURCE OF TRUTH for activating a paid plan — never a browser
 * redirect. Flow:
 *   1. parse Grow's callback (JSON or form-encoded `data[...]`),
 *   2. locate our pending subscription by processId,
 *   3. authenticate it: the stored processToken AND our secret nonce must match,
 *   4. if the charge is approved, activate the plan (idempotently),
 *   5. acknowledge back to Grow (approveTransaction).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { parseCallback, approveTransaction } from "@/lib/subscription/grow";
import { confirmSubscriptionPayment } from "@/server/subscription/service";
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

  const subscription = await prisma.accountSubscription.findFirst({
    where: { processId: event.processId },
  });

  if (!subscription) {
    // Ack so Grow does not retry a notification we cannot match.
    logger.warn("[subscription.webhook] no subscription for process", {
      processId: event.processId,
    });
    return new NextResponse("OK", { status: 200 });
  }

  // Authenticate: the process token AND our nonce must match what we issued.
  const tokenOk = safeEqual(subscription.processToken, event.processToken);
  const nonceOk = !subscription.checkoutNonce || safeEqual(subscription.checkoutNonce, event.nonce);
  if (!tokenOk || !nonceOk) {
    logger.warn("[subscription.webhook] authentication failed", {
      processId: event.processId,
      tokenOk,
      nonceOk,
    });
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!event.paid) {
    logger.info("[subscription.webhook] non-approved status — left pending", {
      subscriptionId: subscription.id,
      statusCode: event.statusCode,
    });
    return new NextResponse("OK", { status: 200 });
  }

  try {
    const { alreadyApplied } = await confirmSubscriptionPayment(subscription, {
      transactionId: event.transactionId,
      cardToken: event.cardToken,
      cardSuffix: event.cardSuffix,
    });
    logger.info("[subscription.webhook] payment confirmed", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      alreadyApplied,
    });
  } catch (err) {
    captureError("subscription.webhook", err, { subscriptionId: subscription.id });
    // 500 → Grow retries; confirmation is idempotent so that is safe.
    return new NextResponse("Error", { status: 500 });
  }

  // Acknowledge receipt to Grow (best-effort — never blocks activation).
  if (subscription.processToken) {
    await approveTransaction({
      processId: event.processId,
      processToken: subscription.processToken,
    });
  }

  return new NextResponse("OK", { status: 200 });
}
