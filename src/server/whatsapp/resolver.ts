/**
 * Central WhatsApp connection resolver.
 *
 * Every send flow must use getWhatsAppProviderForBusiness() instead of calling
 * getWhatsAppProvider() directly. This ensures the correct sender is used for
 * each business and fallback behaviour is consistent.
 *
 * Product model (MVP): customer notifications are sent from Allura's own managed
 * WhatsApp sender by default. Business owners do NOT connect their own WhatsApp
 * Business account — the message body itself states that it is sent by Allura on
 * behalf of the specific business.
 *
 * Priority:
 *   1. Per-business WhatsAppConnection with status=active (legacy / optional /
 *      admin only — most businesses never have one):
 *      - useEnvFallback=true  → phoneNumberId from DB, token from env (Mode A / testing)
 *      - useEnvFallback=false → token from accessTokenEncrypted (Mode B / Embedded Signup)
 *   2. Allura-managed sender — the default for every business. Uses Allura's
 *      global provider credentials from server env. No per-business connection
 *      is required. Active whenever real sending is enabled and the managed
 *      credentials are configured.
 *   3. Disconnected — disabled provider, no send attempted.
 *
 * Safety: access tokens are never logged or returned to the client.
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

export type WhatsAppConnectionMode =
  | "per_business"
  | "allura_managed"
  | "disconnected";

export interface ResolvedWhatsAppConfig {
  mode: WhatsAppConnectionMode;
  provider: WhatsAppProvider;
  /**
   * @deprecated Owner-level "env fallback" is no longer a product concept. Kept
   * for back-compat with existing readers; true whenever the Allura-managed
   * sender (or a Mode A connection) is in use. Prefer {@link isAlluraManaged}.
   */
  isEnvFallback: boolean;
  /** True when the business is sending through Allura's managed WhatsApp sender. */
  isAlluraManaged: boolean;
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
      isAlluraManaged: false,
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
        isAlluraManaged: false,
        isTestMode,
        connectionId: connection.id,
        uiStatus: "חיבור WhatsApp חסר נתונים",
        uiDetail: `חסר ${missingWhat}`,
      };
    }

    // Confirmation gate: a connection created through the guided onboarding flow
    // (connectionSource set) must have its number explicitly confirmed by the
    // owner/admin before any real send. Legacy connections (connectionSource null)
    // are unaffected, so existing live businesses keep sending.
    if (connection.connectionSource && !connection.numberConfirmedAt) {
      return {
        mode: "per_business",
        provider: createDisabledProvider(
          "יש לאשר את מספר ה-WhatsApp המחובר לפני שליחת הודעות",
        ),
        isEnvFallback: connection.useEnvFallback,
        isAlluraManaged: false,
        isTestMode,
        phoneNumberId,
        wabaId: connection.wabaId ?? undefined,
        displayPhoneNumber:
          connection.displayPhoneNumber ?? connection.phoneNumber ?? undefined,
        connectionId: connection.id,
        uiStatus: "ממתין לאישור המספר המחובר",
        uiDetail: "אשרי שזה המספר הנכון בעמוד האוטומציות כדי להתחיל לשלוח",
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
      isAlluraManaged: false,
      isTestMode,
      phoneNumberId,
      wabaId: connection.wabaId ?? undefined,
      displayPhoneNumber:
        connection.displayPhoneNumber ?? connection.phoneNumber ?? undefined,
      connectionId: connection.id,
      uiStatus: "WhatsApp מחובר",
    };
  }

  // --- Priority 2: Allura-managed sender (default for every business) ---
  // No per-business connection exists, so send through Allura's global managed
  // WhatsApp credentials. This is the normal MVP path — the message body itself
  // identifies Allura as the sender on behalf of the business.
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
  const wabaId = process.env.META_WHATSAPP_WABA_ID;

  if (accessToken && phoneNumberId) {
    const baseProvider = createMetaCloudApiProvider({ accessToken, phoneNumberId, apiVersion });
    const provider = isTestMode ? createTestModeProvider(baseProvider) : baseProvider;

    return {
      mode: "allura_managed",
      provider,
      isEnvFallback: true,
      isAlluraManaged: true,
      isTestMode,
      phoneNumberId,
      wabaId: wabaId ?? undefined,
      uiStatus: "הודעות נשלחות דרך WhatsApp של Allura",
    };
  }

  // --- Priority 3: disconnected (managed credentials not configured) ---
  return {
    mode: "disconnected",
    provider: createDisabledProvider(),
    isEnvFallback: false,
    isAlluraManaged: false,
    isTestMode,
    uiStatus: connection
      ? `WhatsApp לא מחובר (סטטוס: ${connection.status})`
      : "שירות ה-WhatsApp של Allura אינו זמין כרגע",
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

/** Where a resolved id came from — purely for safe admin diagnostics. */
export type CredentialSource = "connection" | "env" | "none";

export interface DecryptedWhatsAppCredentials {
  accessToken: string;
  phoneNumberId?: string;
  wabaId?: string;
  apiVersion: string;
  /** Which resolution branch produced these credentials. */
  credentialMode: "allura_managed" | "per_business";
  /** Where the WABA id came from (DB connection vs env vs unset). */
  wabaIdSource: CredentialSource;
  /** Where the phone number id came from (DB connection vs env vs unset). */
  phoneNumberIdSource: CredentialSource;
  /** True when META_WHATSAPP_WABA_ID is present in the environment. */
  envWabaIdPresent: boolean;
}

/**
 * Server-side ONLY. Returns the decrypted access token + ids for a business so
 * template create/sync calls can run. NEVER return this to the client.
 * Resolves the token from Mode B (encrypted) or Mode A (env fallback).
 *
 * Also reports WHERE each id came from (connection vs env) — these source fields
 * are safe (no token) and drive the admin template-sync diagnostics.
 */
export async function getDecryptedCredentialsForBusiness(
  businessId: string,
): Promise<DecryptedWhatsAppCredentials | null> {
  const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
  const envWabaIdPresent = !!process.env.META_WHATSAPP_WABA_ID;

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
  });

  // Allura-managed default: no active per-business connection → use the global
  // managed credentials so admin template create/sync targets Allura's WABA.
  if (!connection || connection.status !== "active") {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) return null;
    return {
      accessToken,
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? undefined,
      wabaId: process.env.META_WHATSAPP_WABA_ID ?? undefined,
      apiVersion,
      credentialMode: "allura_managed",
      wabaIdSource: process.env.META_WHATSAPP_WABA_ID ? "env" : "none",
      phoneNumberIdSource: process.env.META_WHATSAPP_PHONE_NUMBER_ID ? "env" : "none",
      envWabaIdPresent,
    };
  }

  let accessToken: string | undefined;
  if (connection.useEnvFallback) {
    accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  } else {
    accessToken = tryDecryptToken(connection.accessTokenEncrypted) ?? undefined;
  }
  if (!accessToken) return null;

  const wabaId = connection.wabaId ?? process.env.META_WHATSAPP_WABA_ID ?? undefined;
  const phoneNumberId =
    connection.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? undefined;

  return {
    accessToken,
    phoneNumberId,
    wabaId,
    apiVersion,
    credentialMode: "per_business",
    wabaIdSource: connection.wabaId ? "connection" : process.env.META_WHATSAPP_WABA_ID ? "env" : "none",
    phoneNumberIdSource: connection.phoneNumberId
      ? "connection"
      : process.env.META_WHATSAPP_PHONE_NUMBER_ID
        ? "env"
        : "none",
    envWabaIdPresent,
  };
}

export interface WhatsAppReadiness {
  /** True only when the business can send real production WhatsApp messages. */
  ready: boolean;
  /** Hebrew owner-facing status: "WhatsApp לא מחובר" | "מחברים את WhatsApp" | "WhatsApp מחובר" | "יש בעיה בחיבור WhatsApp". */
  statusLabel: string;
  /** Machine-readable connection state for the UI. */
  state: "not_connected" | "pending" | "active" | "error";
  /** Owner-safe display phone (the business's own number). */
  displayPhoneNumber?: string;
  /** Admin-only safe reason when not ready (never a credential). */
  reason?: string;
  /**
   * True when the connection is active but the owner has not yet confirmed the
   * connected number. Sends are blocked until confirmed. Drives the confirmation
   * card. Only set for guided-flow connections (connectionSource present).
   */
  needsNumberConfirmation?: boolean;
  /** Owner's chosen onboarding track ("existing_business_app" | ...), if known. */
  connectionSource?: string;
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
      connectionSource: true,
      numberConfirmedAt: true,
    },
  });

  const displayPhoneNumber =
    connection?.displayPhoneNumber ?? connection?.phoneNumber ?? undefined;

  if (!connection || connection.status === "not_connected") {
    return { ready: false, state: "not_connected", statusLabel: "WhatsApp לא מחובר" };
  }
  if (connection.status === "pending") {
    return { ready: false, state: "pending", statusLabel: "מחברים את WhatsApp" };
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

  // Active + valid credentials, but a guided-flow connection still needs the
  // owner to confirm the number before sends are allowed.
  const needsNumberConfirmation =
    !!connection.connectionSource && !connection.numberConfirmedAt;

  return {
    ready: !needsNumberConfirmation,
    state: "active",
    statusLabel: needsNumberConfirmation ? "ממתין לאישור המספר המחובר" : "WhatsApp מחובר",
    displayPhoneNumber,
    needsNumberConfirmation,
    connectionSource: connection.connectionSource ?? undefined,
  };
}
