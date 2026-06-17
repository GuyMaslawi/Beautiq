"use server";

/**
 * Owner-facing WhatsApp Embedded Signup completion.
 *
 * Called by the "חיבור WhatsApp Business" flow after the owner finishes the
 * Meta popup in the browser. The browser sends us:
 *   - code           — Embedded Signup authorization code
 *   - wabaId         — WhatsApp Business Account id (from the SDK session info)
 *   - phoneNumberId  — Cloud API phone number id (from the SDK session info)
 *
 * Server steps (all server-side, token never reaches the client):
 *   1. Exchange code → business access token.
 *   2. Resolve phone number id (from client, or list the WABA's numbers).
 *   3. Register the number for Cloud API (idempotent).
 *   4. Subscribe our app to the WABA for webhooks.
 *   5. Read the display phone number.
 *   6. Encrypt the token and save an ACTIVE per-business WhatsAppConnection
 *      with useEnvFallback=false (production Mode B).
 *
 * SAFETY: the owner never sees the token, WABA id, or phone number id. On
 * failure the connection is saved with status=error and a scrubbed message.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness } from "@/server/auth/session";
import { encryptToken, isEncryptionConfigured } from "@/lib/whatsapp/crypto";
import {
  exchangeCodeForToken,
  registerPhoneNumber,
  subscribeAppToWaba,
  fetchPhoneNumberInfo,
  fetchFirstWabaPhoneNumber,
  derivePin,
  scrubToken,
} from "@/lib/whatsapp/meta-onboarding";
import { createDefaultTemplatesForBusiness } from "@/server/whatsapp/templates-core";
import type { ConnectionSource, ConnectionTrack } from "@/lib/whatsapp/connection-tracks";

export interface EmbeddedSignupInput {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  /**
   * The onboarding track the owner chose in the pre-connection step. Stored as
   * the connection source for owner-facing guidance + the confirmation gate.
   * Optional and backward-compatible: when absent the source is "unknown".
   */
  intent?: ConnectionTrack;
}

function intentToSource(intent?: ConnectionTrack): ConnectionSource {
  return intent ?? "unknown";
}

export interface EmbeddedSignupResult {
  /** True only when the WhatsApp connection itself succeeded. */
  success: boolean;
  /** Owner-facing Hebrew status label. */
  statusLabel: string;
  /** Owner-safe display phone (the business's own number) — never an internal id. */
  displayPhoneNumber?: string;
  /**
   * Whether the default message templates were prepared after connecting.
   * A `false` here when `success` is `true` means the connection is live but
   * template creation failed — this must NOT be presented as a connection
   * failure (the owner can retry templates from the connected card).
   */
  templatesPrepared?: boolean;
  /** Admin-only, token-scrubbed template error detail (never a credential). */
  templateError?: string;
}

async function saveError(
  businessId: string,
  message: string,
): Promise<EmbeddedSignupResult> {
  const safe = scrubToken(message);
  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: {
      businessId,
      provider: "meta_cloud",
      status: "error",
      useEnvFallback: false,
      lastError: safe,
      disconnectedAt: new Date(),
    },
    update: {
      provider: "meta_cloud",
      status: "error",
      useEnvFallback: false,
      lastError: safe,
      disconnectedAt: new Date(),
    },
  });
  revalidatePath("/automations");
  return { success: false, statusLabel: "יש בעיה בחיבור WhatsApp" };
}

export async function completeEmbeddedSignupAction(
  input: EmbeddedSignupInput,
): Promise<EmbeddedSignupResult> {
  // If this line is absent from production logs after the owner clicks
  // "Continue", the client never reached the server action — debug the
  // FB.login callback in whatsapp-connection-card.tsx, not this file.
  console.log("[WhatsApp Embedded Signup] server action started", {
    hasCode: !!input.code,
    hasWabaId: !!input.wabaId,
    hasPhoneNumberId: !!input.phoneNumberId,
  });

  const business = await requireCurrentBusiness();
  const businessId = business.id;

  if (!input.code) {
    return { success: false, statusLabel: "החיבור בוטל" };
  }

  if (!isEncryptionConfigured()) {
    console.error(
      "[EmbeddedSignup] WHATSAPP_CREDENTIALS_ENCRYPTION_KEY missing — cannot store token securely.",
    );
    return saveError(businessId, "הגדרת אבטחה חסרה בשרת (encryption key)");
  }

  // Mark as in-progress so the UI can show "מחברים את WhatsApp".
  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: { businessId, provider: "meta_cloud", status: "pending", useEnvFallback: false },
    update: { provider: "meta_cloud", status: "pending", useEnvFallback: false, lastError: null },
  });

  // 1. Exchange code → token
  const tokenRes = await exchangeCodeForToken(input.code);
  if (!tokenRes.ok || !tokenRes.accessToken) {
    return saveError(businessId, tokenRes.error ?? "החלפת קוד ההרשאה נכשלה");
  }
  const accessToken = tokenRes.accessToken;

  // 2. Resolve WABA + phone number id
  const wabaId = input.wabaId;
  let phoneNumberId = input.phoneNumberId;
  let displayPhoneNumber: string | undefined;

  if (!wabaId) {
    return saveError(businessId, "לא התקבל מזהה חשבון WhatsApp Business");
  }

  if (!phoneNumberId) {
    const phones = await fetchFirstWabaPhoneNumber(wabaId, accessToken);
    if (!phones.ok || !phones.phoneNumberId) {
      return saveError(businessId, phones.error ?? "לא נמצא מספר טלפון לחיבור");
    }
    phoneNumberId = phones.phoneNumberId;
    displayPhoneNumber = phones.displayPhoneNumber;
  }

  // 3. Register the number for Cloud API (idempotent)
  const register = await registerPhoneNumber(
    phoneNumberId,
    accessToken,
    derivePin(phoneNumberId),
  );
  if (!register.ok) {
    return saveError(businessId, register.error ?? "רישום המספר ל-Cloud API נכשל");
  }

  // 4. Subscribe our app to the WABA for webhooks (non-fatal: log but continue)
  const subscribe = await subscribeAppToWaba(wabaId, accessToken);
  if (!subscribe.ok) {
    console.error(
      `[EmbeddedSignup] subscribe failed businessId=${businessId}: ${subscribe.error}`,
    );
  }

  // 5. Read display phone number (best-effort)
  if (!displayPhoneNumber) {
    const info = await fetchPhoneNumberInfo(phoneNumberId, accessToken);
    if (info.ok) displayPhoneNumber = info.displayPhoneNumber;
  }

  // 6. Encrypt + save active connection (Mode B)
  const now = new Date();
  const accessTokenEncrypted = encryptToken(accessToken);
  const tokenExpiresAt = tokenRes.expiresInSeconds
    ? new Date(now.getTime() + tokenRes.expiresInSeconds * 1000)
    : null;

  // The owner's chosen onboarding track (guidance + confirmation gate only).
  const connectionSource = intentToSource(input.intent);
  // A connection created through the guided flow starts UNCONFIRMED: real sends
  // stay blocked (see the WhatsApp resolver) until the owner confirms the number.
  const shared = {
    provider: "meta_cloud" as const,
    status: "active" as const,
    phoneNumberId,
    displayPhoneNumber: displayPhoneNumber ?? null,
    wabaId,
    accessTokenEncrypted,
    useEnvFallback: false,
    tokenExpiresAt,
    lastVerifiedAt: now,
    connectedAt: now,
    lastError: null,
    disconnectedAt: null,
    connectionSource,
    numberConfirmedAt: null,
  };
  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: { businessId, ...shared },
    update: shared,
  });

  console.log(`[EmbeddedSignup] connected businessId=${businessId} (Mode B, encrypted token stored)`);

  // 7. Auto-create the default templates immediately after connecting (non-fatal).
  //    This is the "מכינים תבניות הודעה" step — the owner does not have to click a
  //    per-card setup button. createTemplate is idempotent (handles alreadyExists),
  //    so re-running is safe. A failure here must NOT fail the connection itself —
  //    the owner can retry from the single "הכנת תבניות WhatsApp" button.
  let templatesPrepared = false;
  let templateError: string | undefined;
  try {
    const tplResult = await createDefaultTemplatesForBusiness(businessId);
    templatesPrepared = tplResult.success;
    if (!tplResult.success) {
      // First per-template error (already owner/admin-safe), scrubbed defensively.
      const firstErr = tplResult.items.find((i) => i.error)?.error;
      templateError = scrubToken(firstErr ?? tplResult.statusLabel);
    }
    console.log(
      `[EmbeddedSignup] auto template setup businessId=${businessId}: ${tplResult.statusLabel}`,
    );
  } catch (err) {
    templateError = "יצירת התבניות נכשלה";
    console.error(`[EmbeddedSignup] auto template setup failed businessId=${businessId}:`, err);
  }

  revalidatePath("/automations");

  // The connection itself succeeded regardless of template outcome. Template
  // failure is surfaced separately so it never reads as a connection failure.
  return {
    success: true,
    statusLabel: templatesPrepared
      ? "WhatsApp מחובר"
      : "WhatsApp מחובר, אך יצירת התבניות נכשלה",
    displayPhoneNumber,
    templatesPrepared,
    templateError,
  };
}

/**
 * Owner/admin: confirm that the connected display number is the correct one.
 *
 * Real sends stay blocked for a guided-flow connection until this is called
 * (see resolveWhatsAppConnectionForBusiness). Business-scoped: only confirms the
 * current business's own active connection, never by raw record id.
 */
export async function confirmConnectedNumberAction(): Promise<{ success: boolean }> {
  const business = await requireCurrentBusiness();
  await prisma.whatsAppConnection.updateMany({
    where: { businessId: business.id, status: "active" },
    data: { numberConfirmedAt: new Date() },
  });
  revalidatePath("/automations");
  return { success: true };
}

/** Owner/admin: disconnect WhatsApp for the current business. */
export async function disconnectWhatsAppAction(): Promise<{ success: boolean }> {
  const business = await requireCurrentBusiness();
  await prisma.whatsAppConnection.updateMany({
    where: { businessId: business.id },
    data: {
      status: "not_connected",
      accessTokenEncrypted: null,
      useEnvFallback: false,
      disconnectedAt: new Date(),
      lastError: null,
    },
  });
  revalidatePath("/automations");
  return { success: true };
}
