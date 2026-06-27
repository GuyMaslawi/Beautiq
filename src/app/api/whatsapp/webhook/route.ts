/**
 * Meta WhatsApp Cloud API — Webhook endpoint (Phase 2C).
 *
 * GET  /api/whatsapp/webhook  — Webhook verification challenge (hub.challenge)
 * POST /api/whatsapp/webhook  — Incoming webhook events
 *
 * Handles:
 *   • Message status updates: sent / delivered / read / failed
 *   • Incoming text messages: STOP / UNSUBSCRIBE / הסר / הסרה → opt-out
 *
 * Security:
 *   • GET:  verifies hub.verify_token against META_WEBHOOK_VERIFY_TOKEN
 *   • POST: verifies X-Hub-Signature-256 HMAC using META_WEBHOOK_APP_SECRET
 *           (skipped with a warning when META_WEBHOOK_APP_SECRET is not set)
 *
 * Always returns 200 for POST after authentication — Meta retries on non-200.
 *
 * Register this URL in the Meta App Dashboard:
 *   https://<your-domain>/api/whatsapp/webhook
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { normalizePhone } from "@/lib/phone";

// This endpoint must never be statically optimized or cached: Meta calls it with
// per-request query params (verification) and live event payloads (POST). Pin it
// to the Node.js runtime so crypto + Prisma behave as on the server.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Meta webhook payload types
// ---------------------------------------------------------------------------

interface MetaStatusError {
  code: number;
  title?: string;
  message?: string;
}

interface MetaStatusEvent {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: MetaStatusError[];
}

interface MetaIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface MetaWebhookValue {
  messaging_product: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  statuses?: MetaStatusEvent[];
  messages?: MetaIncomingMessage[];
}

interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string;
}

interface MetaWebhookEntry {
  id: string;
  changes?: MetaWebhookChange[];
}

interface MetaWebhookPayload {
  object: string;
  entry?: MetaWebhookEntry[];
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification
// ---------------------------------------------------------------------------

function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string,
): boolean {
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// STOP keyword detection
// ---------------------------------------------------------------------------

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "הסר", "הסרה"]);

function isStopMessage(text: string): boolean {
  return STOP_KEYWORDS.has(text.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Process a single status event
// ---------------------------------------------------------------------------

async function processStatusEvent(statusEvent: MetaStatusEvent): Promise<void> {
  const { id: providerMessageId, status, timestamp, errors } = statusEvent;
  const eventTime = new Date(Number(timestamp) * 1000);

  const message = await prisma.automationMessage.findFirst({
    where: { providerMessageId },
  });

  if (!message) {
    console.log(
      `[WhatsApp webhook] status event for unknown providerMessageId=${providerMessageId} status=${status}`,
    );
    return;
  }

  // Build the update fields
  const updateData: {
    status: "sent" | "delivered" | "read" | "failed";
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    failedAt?: Date;
    failureReason?: string;
  } = { status };

  if (status === "sent" && !message.sentAt) {
    updateData.sentAt = eventTime;
  } else if (status === "delivered") {
    updateData.deliveredAt = eventTime;
  } else if (status === "read") {
    updateData.readAt = eventTime;
  } else if (status === "failed") {
    updateData.failedAt = eventTime;
    const firstError = errors?.[0];
    updateData.failureReason = firstError
      ? `${firstError.title ?? "שגיאת מסירה"} (קוד: ${firstError.code})`
      : "שגיאת מסירה מ-Meta";
  }

  await prisma.automationMessage.update({
    where: { id: message.id },
    data: updateData,
  });

  // Update WhatsAppConnection webhook timestamps for the business
  const connectionUpdate: {
    lastWebhookReceivedAt: Date;
    lastDeliveryEventAt?: Date;
    lastReadEventAt?: Date;
  } = { lastWebhookReceivedAt: new Date() };

  if (status === "delivered") connectionUpdate.lastDeliveryEventAt = eventTime;
  if (status === "read") connectionUpdate.lastReadEventAt = eventTime;

  await prisma.whatsAppConnection.updateMany({
    where: { businessId: message.businessId },
    data: connectionUpdate,
  });

  console.log(
    `[WhatsApp webhook] status updated — businessId=${message.businessId} ` +
      `msgId=${message.id} providerMessageId=${providerMessageId} status=${status}`,
  );
}

// ---------------------------------------------------------------------------
// Process a single incoming message (STOP handling)
// ---------------------------------------------------------------------------

async function processIncomingMessage(incomingMsg: MetaIncomingMessage): Promise<void> {
  if (incomingMsg.type !== "text" || !incomingMsg.text?.body) return;

  const body = incomingMsg.text.body;
  if (!isStopMessage(body)) return;

  const senderPhone = normalizePhone(incomingMsg.from);
  const now = new Date();

  // Opt-out all client records matching this phone across all businesses
  const updated = await prisma.client.updateMany({
    where: { normalizedPhone: senderPhone },
    data: {
      whatsappOptIn: false,
      marketingOptIn: false,
      unsubscribedAt: now,
    },
  });

  if (updated.count > 0) {
    console.log(
      `[WhatsApp webhook] opt-out processed — normalizedPhone=${senderPhone} ` +
        `records=${updated.count} keyword="${body.trim()}"`,
    );
  } else {
    // Phone not found — log for visibility but don't error
    console.log(
      `[WhatsApp webhook] opt-out received from unknown phone — normalizedPhone=${senderPhone} keyword="${body.trim()}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// Process a single change object
// ---------------------------------------------------------------------------

async function processChange(change: MetaWebhookChange): Promise<void> {
  if (change.field !== "messages") return;

  const value = change.value;
  if (!value) return;

  const statusEvents = value.statuses ?? [];
  const incomingMessages = value.messages ?? [];

  await Promise.allSettled([
    ...statusEvents.map((s) => processStatusEvent(s)),
    ...incomingMessages.map((m) => processIncomingMessage(m)),
  ]);
}

// ---------------------------------------------------------------------------
// GET — webhook verification challenge
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");

  // Trim both sides: tokens pasted into Vercel/Meta almost always pick up a
  // trailing newline or spaces, which silently breaks a strict === comparison
  // even when the values look identical. This is the most common cause of
  // "The callback URL or verify token couldn't be validated."
  const token = (searchParams.get("hub.verify_token") ?? "").trim();
  const verifyToken = (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim();

  const tokenMatches = verifyToken.length > 0 && token === verifyToken;

  // Safe debug log — never logs the token value itself, only metadata.
  console.log(
    "[WhatsApp webhook] verification attempt — " +
      `mode=${mode ?? "(none)"} ` +
      `tokenPresent=${token.length > 0 ? "yes" : "no"} ` +
      `tokenMatches=${tokenMatches ? "yes" : "no"} ` +
      `challengePresent=${challenge ? "yes" : "no"}`,
  );

  if (!verifyToken) {
    console.error("[WhatsApp webhook] META_WEBHOOK_VERIFY_TOKEN is not set");
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (mode === "subscribe" && tokenMatches && challenge) {
    // Echo the challenge back verbatim as plain text — Meta compares the body
    // byte-for-byte against what it sent.
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — incoming webhook events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Signature verification
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
      console.warn("[WhatsApp webhook] POST rejected — invalid X-Hub-Signature-256");
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: in production an unsigned webhook could be forged to trigger
    // global opt-outs. Never process unverified payloads when running live.
    console.error(
      "[WhatsApp webhook] META_WEBHOOK_APP_SECRET not set in production — rejecting unverified POST",
    );
    return new NextResponse("Forbidden", { status: 403 });
  } else {
    console.warn("[WhatsApp webhook] META_WEBHOOK_APP_SECRET not set — signature verification skipped (non-production)");
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    console.warn("[WhatsApp webhook] POST received invalid JSON body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    // Not our object type — acknowledge and ignore
    return new NextResponse("OK", { status: 200 });
  }

  const changes =
    payload.entry?.flatMap((entry) => entry.changes ?? []) ?? [];

  // Process all changes in parallel; never let one failure abort the rest
  await Promise.allSettled(changes.map((change) => processChange(change)));

  return new NextResponse("OK", { status: 200 });
}
