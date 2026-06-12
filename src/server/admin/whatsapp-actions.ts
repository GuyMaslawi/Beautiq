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
import { getWhatsAppDiagnostic, type WhatsAppDiagnosticResult } from "@/server/whatsapp/resolver";
import {
  createDefaultTemplatesForBusiness,
  syncTemplatesForBusiness,
  type TemplateSetupResult,
} from "@/server/whatsapp/templates-core";
import { createMetaCloudApiProvider } from "@/lib/whatsapp/meta-cloud-api";
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
  let verified = false;
  let displayPhoneNumber: string | undefined;
  let lastError: string | undefined;

  try {
    const provider = createMetaCloudApiProvider({ accessToken, phoneNumberId, apiVersion });
    // Use a lightweight Meta Graph API call to verify — fetch phone number details
    const verifyRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    // Prevent token from appearing in logs even on error
    void provider; // reference to suppress unused warning

    if (verifyRes.ok) {
      const data = (await verifyRes.json()) as {
        display_phone_number?: string;
        verified_name?: string;
      };
      displayPhoneNumber = data.display_phone_number;
      verified = true;
    } else {
      const errData = (await verifyRes.json()) as {
        error?: { message?: string; code?: number };
      };
      const msg = errData.error?.message ?? `HTTP ${verifyRes.status}`;
      // Strip any token hints from error message before saving
      lastError = msg.replace(/EAA\S+/g, "[token]");
      console.error(
        `[adminConnectBusinessFromEnv] Meta verification failed — businessId=${businessId} ` +
          `status=${verifyRes.status} message=${lastError}`,
      );
    }
  } catch (err) {
    lastError =
      err instanceof Error ? err.message.replace(/EAA\S+/g, "[token]") : "שגיאת רשת";
    console.error(
      `[adminConnectBusinessFromEnv] network error — businessId=${businessId}`,
      lastError,
    );
  }

  const now = new Date();

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

/** Admin: disconnect a business's WhatsApp and clear its stored token. */
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
    },
  });
  revalidatePath(`/admin/businesses/${businessId}`);
  return { success: true };
}
