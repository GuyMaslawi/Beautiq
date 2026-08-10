/**
 * Grow (Meshulam) server-to-server notification for Allura subscriptions.
 *
 *   POST /api/subscription/webhook
 *
 * This is the SOURCE OF TRUTH for activating a paid plan — never a browser
 * redirect. Grow reaches this one endpoint over three different channels, and
 * they do not look alike (see `parseCallback` for the field-name union):
 *
 *   - the per-link `notifyUrl` passed at checkout — the FIRST charge,
 *     authenticated by the `?t=` secret we embedded in that URL;
 *   - the account-level webhook "עדכון לאחר ביצוע עסקה" with the
 *     "ריצות הוראת קבע" report ticked — the ONLY channel that reports the
 *     automatic monthly renewals;
 *   - the account-level webhook "עדכון עבור הוראת קבע שנכשלה" — a declined
 *     standing order.
 *
 * The account-level channels cannot carry a query string of ours: they
 * authenticate by echoing a constant we configure in Grow ("פרמטר מזהה"),
 * inside the body. Both forms are accepted below; anything else is rejected.
 *
 * Flow: parse → authenticate the sender → locate the subscription (processId
 * for a first charge, directDebitId for a renewal) → authenticate the charge
 * itself → activate / extend / lapse, idempotently. Every call is written to
 * the callback log first, including rejected ones.
 */

import { NextResponse } from "next/server";
import { AccountSubscriptionStatus, type AccountSubscription } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { parseCallback, approveTransaction, bodyCarriesSecret } from "@/lib/subscription/grow";
import { confirmSubscriptionPayment, markRenewalFailed } from "@/server/subscription/service";
import { recordGrowCallback } from "@/server/subscription/callback-log";
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

function webhookSecret(): string | undefined {
  return process.env.SUBSCRIPTION_WEBHOOK_SECRET?.trim() || undefined;
}

/**
 * The `webhook key` values Grow generated for our account-level webhooks.
 *
 * A list, because Grow mints a separate key per webhook and we register more
 * than one (the renewal runs and the failed standing orders are different
 * webhooks, and their reports are mutually exclusive in Grow's form). A single
 * key would authenticate only one of them. Comma-separated in the env var.
 */
function growWebhookKeys(): string[] {
  return (process.env.GROW_WEBHOOK_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * The endpoint secret every notification must present, in whichever form its
 * channel allows.
 *
 * Grow signs nothing, so the sender is authenticated with a shared secret:
 * embedded in the per-link notifyUrl as `?t=<secret>`, or echoed inside the
 * body as the constant "פרמטר מזהה" configured on the account-level webhook. A
 * header is accepted too, for a Make scenario that prefers to send one.
 *
 * Fails CLOSED: with no secret configured every notification is rejected, and
 * checkEnv() makes the variable a hard startup error whenever SUBSCRIPTIONS_ENABLED
 * is on, so a misconfiguration surfaces at boot rather than as silent free access.
 */
function isAuthenticSender(req: Request, body: Record<string, unknown>): boolean {
  const secret = webhookSecret();
  const keys = growWebhookKeys();
  if (!secret && keys.length === 0) return false;

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
    secretEquals(req.headers.get("x-allura-webhook-secret"), secret) ||
    bodyCarriesSecret(body, secret) ||
    keys.some((key) => bodyCarriesSecret(body, key))
  );
}

/** Raise a human alert — these are the failures nobody would otherwise see. */
function alert(message: string, context: Record<string, unknown>): void {
  captureError("subscription.webhook", new Error(message), context);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  const body = parseBody(rawBody, contentType);
  const secrets = [webhookSecret(), ...growWebhookKeys()];

  // ── Gate 1: authenticate the SENDER, for every notification type ───────────
  // Without this, anyone who learns or guesses a Grow directDebitId can POST a
  // forged "paid" renewal (free plan forever) or a forged "failed" one (lapsing
  // a paying customer). The per-transaction processToken check below only ever
  // covered the FIRST charge, leaving every recurring run unauthenticated.
  if (!isAuthenticSender(req, body)) {
    logger.warn("[subscription.webhook] rejected — sender not authenticated");
    // Recorded, not discarded: a misconfigured "פרמטר מזהה" in Grow looks
    // exactly like an attack from here, and the raw body is the only thing that
    // tells the two apart.
    await recordGrowCallback({ result: "unauthenticated", raw: rawBody, contentType, secrets });
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const event = parseCallback(body);
  if (!event) {
    logger.warn("[subscription.webhook] unparseable callback");
    await recordGrowCallback({ result: "unparseable", raw: rawBody, contentType, secrets });
    alert("Grow callback could not be parsed", { contentType });
    return new NextResponse("Bad Request", { status: 400 });
  }

  const trace = {
    raw: rawBody,
    contentType,
    secrets,
    processId: event.processId,
    directDebitId: event.directDebitId,
    transactionId: event.transactionId,
    statusCode: event.statusCode,
    sumMinor: event.sumMinor,
    isRecurringRun: event.isRecurringRun,
  };

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
    // Ack so Grow does not retry a notification we cannot match — but never
    // silently. An unmatched RENEWAL is the exact shape of the failure this
    // whole endpoint exists to prevent: money left the customer's card and no
    // subscription was extended, because we stored the standing-order id under
    // a name Grow does not use.
    logger.warn("[subscription.webhook] no subscription for notification", {
      processId: event.processId,
      directDebitId: event.directDebitId,
    });
    await recordGrowCallback({ ...trace, result: "unmatched" });
    alert("Grow notification matched no subscription", {
      processId: event.processId,
      directDebitId: event.directDebitId,
      isRecurringRun: event.isRecurringRun,
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
      await recordGrowCallback({
        ...trace,
        result: "unauthenticated",
        subscriptionId: subscription.id,
        note: tokenOk ? "nonce mismatch" : "process token mismatch",
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
    await recordGrowCallback({
      ...trace,
      result: "ignored_cancelled",
      subscriptionId: subscription.id,
      userId: subscription.userId,
      note: `status ${subscription.status}`,
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
    await recordGrowCallback({
      ...trace,
      result: "amount_mismatch",
      subscriptionId: subscription.id,
      userId: subscription.userId,
      note: `expected ${subscription.priceMinor}, received ${event.sumMinor}`,
    });
    // Alerted, because the innocent explanation is as damaging as the hostile
    // one: if this channel reports sums in agorot rather than shekels, EVERY
    // real payment lands here and is ignored, and the customer sees nothing.
    alert("Grow charge amount does not match the subscription", {
      subscriptionId: subscription.id,
      expected: subscription.priceMinor,
      received: event.sumMinor,
    });
    return new NextResponse("OK", { status: 200 });
  }

  // Neither approval nor failure evidence. Guessing costs either a free month
  // or a wrongly locked-out paying customer, so we change nothing and ask a
  // human to read the captured body.
  if (event.outcome === "unknown") {
    logger.warn("[subscription.webhook] outcome unknown — no state change", {
      subscriptionId: subscription.id,
    });
    await recordGrowCallback({
      ...trace,
      result: "outcome_unknown",
      subscriptionId: subscription.id,
      userId: subscription.userId,
    });
    alert("Grow notification carried no payment outcome", {
      subscriptionId: subscription.id,
      isRecurringRun: event.isRecurringRun,
    });
    return new NextResponse("OK", { status: 200 });
  }

  if (event.outcome === "failed") {
    const reason =
      event.failureReason ?? `direct debit not approved (status ${event.statusCode ?? "?"})`;
    // A failed automatic renewal lapses the sub after the grace window; a failed
    // first charge just leaves it pending (the owner can retry checkout).
    if (!matchedByProcess || event.isRecurringRun) {
      const { lapsed } = await markRenewalFailed(subscription, reason);
      logger.info("[subscription.webhook] renewal charge failed", {
        subscriptionId: subscription.id,
        lapsed,
        attempts: event.attempts,
      });
      // A declined renewal is money that stopped arriving. Nothing else in the
      // product would ever say so out loud.
      alert("Grow renewal charge failed", {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        reason,
        attempts: event.attempts,
        lapsed,
      });
    } else {
      logger.info("[subscription.webhook] first charge not approved — left pending", {
        subscriptionId: subscription.id,
        statusCode: event.statusCode,
      });
    }
    await recordGrowCallback({
      ...trace,
      result: "failed",
      subscriptionId: subscription.id,
      userId: subscription.userId,
      note: reason,
    });
    return new NextResponse("OK", { status: 200 });
  }

  try {
    const { alreadyApplied } = await confirmSubscriptionPayment(subscription, {
      transactionId: event.transactionId,
      directDebitId: event.directDebitId,
      cardSuffix: event.cardSuffix,
      // A charge we did not match by our own processId can only be an automatic
      // monthly run — that is the only notification Grow sends without one.
      isRecurring: event.isRecurringRun || !matchedByProcess,
    });
    logger.info("[subscription.webhook] payment confirmed", {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      recurring: event.isRecurringRun,
      alreadyApplied,
    });
    await recordGrowCallback({
      ...trace,
      result: "paid",
      subscriptionId: subscription.id,
      userId: subscription.userId,
      note: alreadyApplied ? "duplicate — already applied" : undefined,
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
