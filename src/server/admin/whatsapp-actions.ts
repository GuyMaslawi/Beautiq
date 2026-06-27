"use server";

/**
 * Admin-only WhatsApp management actions.
 *
 * These actions are exclusively for platform admins — never exposed to business owners.
 *
 * adminConnectBusinessFromEnv  — create/update a WhatsAppConnection for one business
 *                                using env vars (Mode A / testing only).
 * adminCheckWhatsAppDiagnostic — return safe Hebrew diagnostic status for a business.
 *
 * Future: when Meta Embedded Signup is implemented, a separate action will create
 * WhatsAppConnection with useEnvFallback=false and store an encrypted token.
 */

import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import {
  getWhatsAppDiagnostic,
  getDecryptedCredentialsForBusiness,
  type WhatsAppDiagnosticResult,
} from "@/server/whatsapp/resolver";
import {
  createDefaultTemplatesForBusiness,
  syncTemplatesForBusiness,
  type TemplateSetupResult,
} from "@/server/whatsapp/templates-core";
import { revalidatePath } from "next/cache";

export interface ConnectFromEnvResult {
  success: boolean;
  statusLabel: string;
  phoneNumberId?: string;
  wabaId?: string;
  /** True when Meta API verification succeeded */
  verified: boolean;
  error?: string;
}

export interface ConfirmNumberResult {
  success: boolean;
  statusLabel: string;
  phoneNumberId?: string;
  wabaId?: string;
  /** ISO timestamp of confirmation when success=true */
  confirmedAt?: string;
  error?: string;
}

/**
 * Lightweight reachability check: confirms the given Phone Number ID is readable
 * with the current access token via the Meta Graph API. Never logs or returns
 * the token; error messages are scrubbed of any token-like substring.
 */
async function verifyPhoneNumberReachable(opts: {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}): Promise<{ reachable: boolean; displayPhoneNumber?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${opts.apiVersion}/${opts.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${opts.accessToken}` }, cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { display_phone_number?: string };
      return { reachable: true, displayPhoneNumber: data.display_phone_number };
    }
    const errData = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
    };
    const msg = errData.error?.message ?? `HTTP ${res.status}`;
    return { reachable: false, error: msg.replace(/EAA\S+/g, "[token]") };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message.replace(/EAA\S+/g, "[token]") : "שגיאת רשת",
    };
  }
}

/**
 * Creates or updates a WhatsAppConnection for the given business using current env vars.
 * Sets useEnvFallback=true — the access token stays in env, not in DB.
 * Only sets status=active when Meta API verification succeeds.
 *
 * Admin-only. Never stores or logs the access token.
 */
export async function adminConnectBusinessFromEnv(
  businessId: string,
): Promise<ConnectFromEnvResult> {
  await requirePlatformAdmin();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    return { success: false, statusLabel: "העסק לא נמצא", verified: false };
  }

  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.META_WHATSAPP_WABA_ID || undefined;
  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";

  if (!accessToken) {
    return {
      success: false,
      statusLabel: "חסר Access Token — יש להגדיר META_WHATSAPP_ACCESS_TOKEN",
      verified: false,
    };
  }
  if (!phoneNumberId) {
    return {
      success: false,
      statusLabel: "חסר Phone Number ID — יש להגדיר META_WHATSAPP_PHONE_NUMBER_ID",
      verified: false,
    };
  }

  // Verify credentials against Meta API before saving
  const check = await verifyPhoneNumberReachable({ accessToken, phoneNumberId, apiVersion });
  const verified = check.reachable;
  const displayPhoneNumber = check.displayPhoneNumber;
  const lastError = check.error;
  if (!verified) {
    console.error(
      `[adminConnectBusinessFromEnv] Meta verification failed — businessId=${businessId} message=${lastError}`,
    );
  }

  const now = new Date();

  // This is an Allura-managed / env (Mode A) connection — it is NOT a guided
  // owner-onboarding flow, so it must never sit behind the number-confirmation
  // gate. On a successful phone check we confirm the number automatically
  // (numberConfirmedAt) and clear any stale guided-flow connectionSource so the
  // resolver's gate (connectionSource && !numberConfirmedAt) can never block it.
  await prisma.whatsAppConnection.upsert({
    where: { businessId },
    create: {
      businessId,
      provider: "meta_cloud",
      status: verified ? "active" : "error",
      phoneNumberId,
      displayPhoneNumber: displayPhoneNumber ?? null,
      wabaId: wabaId ?? null,
      useEnvFallback: true,
      lastVerifiedAt: verified ? now : null,
      lastError: lastError ?? null,
      connectedAt: verified ? now : null,
      connectionSource: null,
      numberConfirmedAt: verified ? now : null,
    },
    update: {
      provider: "meta_cloud",
      status: verified ? "active" : "error",
      phoneNumberId,
      displayPhoneNumber: displayPhoneNumber ?? null,
      wabaId: wabaId ?? null,
      useEnvFallback: true,
      lastVerifiedAt: verified ? now : undefined,
      lastError: lastError ?? null,
      connectedAt: verified ? now : undefined,
      disconnectedAt: verified ? null : now,
      connectionSource: null,
      numberConfirmedAt: verified ? now : null,
    },
  });

  revalidatePath(`/admin/businesses/${businessId}`);

  if (!verified) {
    return {
      success: false,
      statusLabel: `אימות Meta נכשל — ${lastError ?? "שגיאה לא ידועה"}`,
      phoneNumberId,
      wabaId,
      verified: false,
    };
  }

  return {
    success: true,
    statusLabel: displayPhoneNumber
      ? `WhatsApp מחובר — ${displayPhoneNumber}`
      : "WhatsApp מחובר בהצלחה",
    phoneNumberId,
    wabaId,
    verified: true,
  };
}

/**
 * Returns safe Hebrew diagnostic for one business.
 * Never exposes tokens or raw credentials.
 */
export async function adminCheckWhatsAppDiagnostic(
  businessId: string,
): Promise<WhatsAppDiagnosticResult> {
  await requirePlatformAdmin();
  return getWhatsAppDiagnostic(businessId);
}

/** Admin: create the 4 default templates in a business's WABA. */
export async function adminCreateTemplatesForBusiness(
  businessId: string,
): Promise<TemplateSetupResult> {
  await requirePlatformAdmin();
  const result = await createDefaultTemplatesForBusiness(businessId);
  revalidatePath(`/admin/businesses/${businessId}`);
  return result;
}

/** Admin: sync template statuses from a business's WABA. */
export async function adminSyncTemplatesForBusiness(
  businessId: string,
): Promise<TemplateSetupResult> {
  await requirePlatformAdmin();
  const result = await syncTemplatesForBusiness(businessId);
  revalidatePath(`/admin/businesses/${businessId}`);
  return result;
}

/**
 * Admin: disconnect a business's WhatsApp and clear its stored token.
 *
 * Sets status=not_connected and clears the guided-flow gate fields
 * (connectionSource / numberConfirmedAt). With no active per-business
 * connection, the resolver falls through to the Allura-managed (env) sender,
 * which does NOT require number confirmation — so disconnecting cleanly forces
 * env fallback without leaving a stale gate behind.
 */
export async function adminDisconnectBusiness(
  businessId: string,
): Promise<{ success: boolean }> {
  await requirePlatformAdmin();
  await prisma.whatsAppConnection.updateMany({
    where: { businessId },
    data: {
      status: "not_connected",
      accessTokenEncrypted: null,
      useEnvFallback: false,
      disconnectedAt: new Date(),
      lastError: null,
      connectionSource: null,
      numberConfirmedAt: null,
    },
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  return { success: true };
}

/**
 * Admin: confirm the connected number for an existing active connection.
 *
 * Use this to clear a stuck confirmation gate — an active connection that was
 * created through the guided flow (connectionSource set) but never had its
 * number confirmed (numberConfirmedAt=null), so the resolver blocks every send
 * with NUMBER_NOT_CONFIRMED_REASON ("awaiting_confirmation" in the message log).
 *
 * numberConfirmedAt is set ONLY after a live Meta Graph API check confirms the
 * Phone Number ID is reachable with the current token. Never logs the token.
 */
export async function adminConfirmConnectedNumber(
  businessId: string,
): Promise<ConfirmNumberResult> {
  await requirePlatformAdmin();

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
    select: {
      status: true,
      phoneNumberId: true,
      wabaId: true,
      displayPhoneNumber: true,
    },
  });

  if (!connection) {
    return { success: false, statusLabel: "אין חיבור WhatsApp לעסק זה" };
  }
  if (connection.status !== "active") {
    return {
      success: false,
      statusLabel: `החיבור אינו פעיל (סטטוס: ${connection.status}) — יש לחבר מחדש לפני אישור`,
    };
  }

  const creds = await getDecryptedCredentialsForBusiness(businessId);
  if (!creds?.accessToken) {
    return { success: false, statusLabel: "לא ניתן לאחזר Access Token לעסק" };
  }

  const phoneNumberId = connection.phoneNumberId ?? creds.phoneNumberId;
  if (!phoneNumberId) {
    return { success: false, statusLabel: "חסר Phone Number ID — לא ניתן לאמת" };
  }

  const check = await verifyPhoneNumberReachable({
    accessToken: creds.accessToken,
    phoneNumberId,
    apiVersion: creds.apiVersion,
  });

  if (!check.reachable) {
    await prisma.whatsAppConnection.update({
      where: { businessId },
      data: { lastError: check.error ?? "אימות המספר נכשל" },
    });
    revalidatePath(`/admin/businesses/${businessId}`);
    console.error(
      `[adminConfirmConnectedNumber] reachability check failed — businessId=${businessId} message=${check.error}`,
    );
    return {
      success: false,
      statusLabel: `אימות המספר נכשל — ${check.error ?? "שגיאה לא ידועה"}`,
      phoneNumberId,
      wabaId: connection.wabaId ?? undefined,
      error: check.error,
    };
  }

  const now = new Date();
  await prisma.whatsAppConnection.update({
    where: { businessId },
    data: {
      numberConfirmedAt: now,
      lastVerifiedAt: now,
      lastError: null,
      displayPhoneNumber: check.displayPhoneNumber ?? connection.displayPhoneNumber ?? undefined,
    },
  });
  revalidatePath(`/admin/businesses/${businessId}`);

  return {
    success: true,
    statusLabel: check.displayPhoneNumber
      ? `המספר אושר — ${check.displayPhoneNumber}`
      : "המספר אושר בהצלחה — שליחה מאופשרת",
    phoneNumberId,
    wabaId: connection.wabaId ?? undefined,
    confirmedAt: now.toISOString(),
  };
}
