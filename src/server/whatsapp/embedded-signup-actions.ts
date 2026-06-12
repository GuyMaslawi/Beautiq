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

export interface EmbeddedSignupInput {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}

export interface EmbeddedSignupResult {
  success: boolean;
  /** Owner-facing Hebrew status label. */
  statusLabel: string;
  /** Owner-safe display phone (the business's own number) — never an internal id. */
  displayPhoneNumber?: string;
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

  // Mark as in-progress so the UI can show "חיבור WhatsApp בתהליך".
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

  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: {
      businessId,
      provider: "meta_cloud",
      status: "active",
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
    },
    update: {
      provider: "meta_cloud",
      status: "active",
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
    },
  });

  console.log(`[EmbeddedSignup] connected businessId=${businessId} (Mode B, encrypted token stored)`);
  revalidatePath("/automations");

  return {
    success: true,
    statusLabel: "WhatsApp מחובר",
    displayPhoneNumber,
  };
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
