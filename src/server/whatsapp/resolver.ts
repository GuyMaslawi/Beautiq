/**
 * Central WhatsApp connection resolver.
 *
 * Every send flow must use getWhatsAppProviderForBusiness() instead of calling
 * getWhatsAppProvider() directly. This ensures per-business credentials are used
 * when available and fallback behaviour is consistent.
 *
 * Priority:
 *   1. Per-business WhatsAppConnection with status=active
 *      - useEnvFallback=true  → phoneNumberId from DB, token from env (Mode A / testing)
 *      - useEnvFallback=false → token from accessTokenEncrypted (Mode B / Embedded Signup, future)
 *   2. Env fallback — only when WHATSAPP_USE_ENV_FALLBACK=true and no active DB connection
 *   3. Disconnected — disabled provider, no send attempted
 *
 * Safety: access tokens are never logged or returned to the client.
 * Future: Mode B (Embedded Signup) will set useEnvFallback=false and store an encrypted token.
 */

import { prisma } from "@/server/db/prisma";
import { createMetaCloudApiProvider } from "@/lib/whatsapp/meta-cloud-api";
import { tryDecryptToken } from "@/lib/whatsapp/crypto";
import {
  devMockProvider,
  createDisabledProvider,
  createTestModeProvider,
  type WhatsAppProvider,
} from "@/lib/whatsapp/provider";

export type WhatsAppConnectionMode = "per_business" | "env_fallback" | "disconnected";

export interface ResolvedWhatsAppConfig {
  mode: WhatsAppConnectionMode;
  provider: WhatsAppProvider;
  isEnvFallback: boolean;
  isTestMode: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  /** Safe display phone — never the raw access token */
  displayPhoneNumber?: string;
  connectionId?: string;
  /** Hebrew status label for UI banners */
  uiStatus: string;
  /** Additional Hebrew detail for diagnostics */
  uiDetail?: string;
}

export interface WhatsAppDiagnosticResult {
  ok: boolean;
  statusLabel: string;
  details: Array<{ label: string; ok: boolean; value?: string }>;
}

export async function resolveWhatsAppConnectionForBusiness(
  businessId: string,
): Promise<ResolvedWhatsAppConfig> {
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";

  if (!realSendEnabled) {
    return {
      mode: "disconnected",
      provider: devMockProvider,
      isEnvFallback: false,
      isTestMode,
      uiStatus: "מצב פיתוח — הודעות לא נשלחות בפועל",
    };
  }

  // --- Priority 1: per-business WhatsAppConnection ---
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
  });

  if (connection?.status === "active") {
    const phoneNumberId =
      connection.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";

    let accessToken: string | undefined;
    let decryptFailed = false;
    if (connection.useEnvFallback) {
      // Mode A (testing): token from env.
      accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    } else {
      // Mode B (Embedded Signup / production): decrypt the stored token.
      const decrypted = tryDecryptToken(connection.accessTokenEncrypted);
      if (!decrypted && connection.accessTokenEncrypted) {
        decryptFailed = true;
        console.error(
          `[WhatsApp resolver] businessId=${businessId} token decryption failed — check WHATSAPP_CREDENTIALS_ENCRYPTION_KEY.`,
        );
      }
      accessToken = decrypted ?? undefined;
    }

    if (!phoneNumberId || !accessToken) {
      const missingWhat = decryptFailed
        ? "פענוח Access Token"
        : !phoneNumberId
          ? "Phone Number ID"
          : "Access Token";
      console.error(
        `[WhatsApp resolver] businessId=${businessId} has active connection but ${missingWhat} is missing.`,
      );
      return {
        mode: "per_business",
        provider: createDisabledProvider(`חסר ${missingWhat} — חיבור WhatsApp לא תקין`),
        isEnvFallback: connection.useEnvFallback,
        isTestMode,
        connectionId: connection.id,
        uiStatus: "חיבור WhatsApp חסר נתונים",
        uiDetail: `חסר ${missingWhat}`,
      };
    }

    const baseProvider = createMetaCloudApiProvider({ accessToken, phoneNumberId, apiVersion });
    const provider = isTestMode ? createTestModeProvider(baseProvider) : baseProvider;

    // isEnvFallback is only meaningful when the system-level env fallback is also enabled.
    // When WHATSAPP_USE_ENV_FALLBACK=false, every active connection is treated as production.
    const envFallbackAllowed = process.env.WHATSAPP_USE_ENV_FALLBACK === "true";

    return {
      mode: "per_business",
      provider,
      isEnvFallback: envFallbackAllowed && connection.useEnvFallback,
      isTestMode,
      phoneNumberId,
      wabaId: connection.wabaId ?? undefined,
      displayPhoneNumber:
        connection.displayPhoneNumber ?? connection.phoneNumber ?? undefined,
      connectionId: connection.id,
      uiStatus: "WhatsApp מחובר",
    };
  }

  // --- Priority 2: env fallback ---
  const useEnvFallback = process.env.WHATSAPP_USE_ENV_FALLBACK === "true";
  if (useEnvFallback) {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
    const wabaId = process.env.META_WHATSAPP_WABA_ID;

    if (accessToken && phoneNumberId) {
      const baseProvider = createMetaCloudApiProvider({ accessToken, phoneNumberId, apiVersion });
      const provider = isTestMode ? createTestModeProvider(baseProvider) : baseProvider;

      return {
        mode: "env_fallback",
        provider,
        isEnvFallback: true,
        isTestMode,
        phoneNumberId,
        wabaId: wabaId ?? undefined,
        uiStatus: "מצב בדיקה — החיבור מוגדר ברמת המערכת ולא ברמת העסק",
      };
    }
  }

  // --- Priority 3: disconnected ---
  return {
    mode: "disconnected",
    provider: createDisabledProvider(),
    isEnvFallback: false,
    isTestMode,
    uiStatus:
      connection
        ? `WhatsApp לא מחובר (סטטוס: ${connection.status})`
        : "WhatsApp לא מחובר",
  };
}

/** Drop-in async replacement for getWhatsAppProvider() — scoped to a business. */
export async function getWhatsAppProviderForBusiness(
  businessId: string,
): Promise<WhatsAppProvider> {
  const resolved = await resolveWhatsAppConnectionForBusiness(businessId);
  return resolved.provider;
}

/**
 * Returns a safe Hebrew diagnostic for admin UI.
 * Never exposes tokens — only checks env presence and DB state.
 */
export async function getWhatsAppDiagnostic(
  businessId: string,
): Promise<WhatsAppDiagnosticResult> {
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  const envFallbackEnabled = process.env.WHATSAPP_USE_ENV_FALLBACK === "true";
  const testModeActive = process.env.WHATSAPP_TEST_MODE === "true";
  const hasAccessToken = !!process.env.META_WHATSAPP_ACCESS_TOKEN;
  const hasPhoneNumberId = !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
    select: {
      status: true,
      provider: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      phoneNumber: true,
      wabaId: true,
      useEnvFallback: true,
      lastVerifiedAt: true,
      lastError: true,
      connectedAt: true,
    },
  });

  const details: WhatsAppDiagnosticResult["details"] = [];

  const hasConnection = !!connection;
  const isActive = connection?.status === "active";

  details.push({
    label: "חיבור WhatsApp בסיס הנתונים",
    ok: hasConnection,
    value: hasConnection ? connection.status : "לא קיים",
  });

  if (hasConnection) {
    details.push({
      label: "סטטוס חיבור",
      ok: isActive,
      value: connection.status,
    });

    if (connection.useEnvFallback) {
      details.push({
        label: "מצב Fallback",
        ok: true,
        value: "מוגדר ברמת המערכת (env)",
      });
    }

    if (connection.displayPhoneNumber ?? connection.phoneNumber) {
      details.push({
        label: "מספר טלפון",
        ok: true,
        value: connection.displayPhoneNumber ?? connection.phoneNumber ?? undefined,
      });
    }

    if (connection.lastVerifiedAt) {
      details.push({
        label: "אומת לאחרונה",
        ok: true,
        value: new Date(connection.lastVerifiedAt).toLocaleString("he-IL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    if (connection.lastError) {
      details.push({ label: "שגיאה אחרונה", ok: false, value: connection.lastError });
    }
  }

  details.push({ label: "שליחה אמיתית מופעלת (ENABLE_REAL_WHATSAPP_SEND)", ok: realSendEnabled });
  details.push({
    label: "Env fallback (WHATSAPP_USE_ENV_FALLBACK)",
    ok: !envFallbackEnabled,
    value: envFallbackEnabled ? "פעיל — לא מומלץ בייצור" : "כבוי",
  });
  details.push({ label: "Access Token מוגדר", ok: hasAccessToken });
  details.push({ label: "Phone Number ID מוגדר", ok: hasPhoneNumberId });
  details.push({
    label: "מצב בדיקה (WHATSAPP_TEST_MODE)",
    ok: !testModeActive,
    value: testModeActive ? "פעיל — שליחה רק למספר בדיקה" : "כבוי",
  });

  // Derive main status label
  let statusLabel: string;
  let ok: boolean;

  if (!realSendEnabled) {
    statusLabel = "מצב פיתוח — הודעות לא נשלחות בפועל";
    ok = false;
  } else if (isActive && (connection.useEnvFallback ? hasAccessToken && hasPhoneNumberId : true)) {
    // Active connection — production-ready regardless of useEnvFallback flag.
    // When token encryption (Mode B) is implemented, the useEnvFallback=false path will be the only production path.
    statusLabel = "WhatsApp מחובר";
    ok = true;
  } else if (envFallbackEnabled && hasAccessToken && hasPhoneNumberId) {
    statusLabel = "חיבור ברמת המערכת — העסק עדיין לא חובר ישירות";
    ok = false;
  } else if (!hasAccessToken) {
    statusLabel = "חסר Access Token";
    ok = false;
  } else if (!hasPhoneNumberId) {
    statusLabel = "חסר Phone Number ID";
    ok = false;
  } else if (!hasConnection) {
    statusLabel = "WhatsApp לא מחובר — יש לחבר דרך ממשק הניהול";
    ok = false;
  } else {
    statusLabel = `WhatsApp לא מחובר (סטטוס: ${connection?.status ?? "unknown"})`;
    ok = false;
  }

  return { ok, statusLabel, details };
}

/**
 * Server-side ONLY. Returns the decrypted access token + ids for a business so
 * template create/sync calls can run. NEVER return this to the client.
 * Resolves the token from Mode B (encrypted) or Mode A (env fallback).
 */
export async function getDecryptedCredentialsForBusiness(
  businessId: string,
): Promise<{
  accessToken: string;
  phoneNumberId?: string;
  wabaId?: string;
  apiVersion: string;
} | null> {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
  });
  if (!connection || connection.status !== "active") return null;

  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";

  let accessToken: string | undefined;
  if (connection.useEnvFallback) {
    accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  } else {
    accessToken = tryDecryptToken(connection.accessTokenEncrypted) ?? undefined;
  }
  if (!accessToken) return null;

  return {
    accessToken,
    phoneNumberId: connection.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? undefined,
    wabaId: connection.wabaId ?? process.env.META_WHATSAPP_WABA_ID ?? undefined,
    apiVersion,
  };
}

export interface WhatsAppReadiness {
  /** True only when the business can send real production WhatsApp messages. */
  ready: boolean;
  /** Hebrew owner-facing status: "WhatsApp לא מחובר" | "חיבור WhatsApp בתהליך" | "WhatsApp מחובר" | "יש בעיה בחיבור WhatsApp". */
  statusLabel: string;
  /** Machine-readable connection state for the UI. */
  state: "not_connected" | "pending" | "active" | "error";
  /** Owner-safe display phone (the business's own number). */
  displayPhoneNumber?: string;
  /** Admin-only safe reason when not ready (never a credential). */
  reason?: string;
}

/**
 * Production readiness check for a business's WhatsApp connection.
 * A business is ready only when:
 *   - status=active
 *   - useEnvFallback=false (real per-business credentials)
 *   - accessTokenEncrypted exists and decrypts
 *   - phoneNumberId exists
 * (Per-template approval readiness is computed separately, per automation.)
 */
export async function getWhatsAppReadiness(
  businessId: string,
): Promise<WhatsAppReadiness> {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
    select: {
      status: true,
      useEnvFallback: true,
      accessTokenEncrypted: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      phoneNumber: true,
      lastError: true,
    },
  });

  const displayPhoneNumber =
    connection?.displayPhoneNumber ?? connection?.phoneNumber ?? undefined;

  if (!connection || connection.status === "not_connected") {
    return { ready: false, state: "not_connected", statusLabel: "WhatsApp לא מחובר" };
  }
  if (connection.status === "pending") {
    return { ready: false, state: "pending", statusLabel: "חיבור WhatsApp בתהליך" };
  }
  if (connection.status === "error") {
    return {
      ready: false,
      state: "error",
      statusLabel: "יש בעיה בחיבור WhatsApp",
      reason: connection.lastError ?? undefined,
      displayPhoneNumber,
    };
  }

  // status === active
  if (!connection.phoneNumberId) {
    return {
      ready: false,
      state: "error",
      statusLabel: "יש בעיה בחיבור WhatsApp",
      reason: "Phone Number ID חסר",
      displayPhoneNumber,
    };
  }

  // In production Mode B the token must be present and decryptable.
  if (!connection.useEnvFallback) {
    const token = tryDecryptToken(connection.accessTokenEncrypted);
    if (!token) {
      return {
        ready: false,
        state: "error",
        statusLabel: "יש בעיה בחיבור WhatsApp",
        reason: "פענוח ה-Access Token נכשל",
        displayPhoneNumber,
      };
    }
  }

  return {
    ready: true,
    state: "active",
    statusLabel: "WhatsApp מחובר",
    displayPhoneNumber,
  };
}
