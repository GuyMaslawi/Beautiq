/**
 * WhatsApp provider abstraction.
 *
 * All real sending goes through this interface so the business logic is never
 * locked to one vendor. In dev/test mode the only active implementation is the
 * dev mock — it logs clearly and never sends a real message.
 *
 * Phase 2A supports: dev_mock (default), meta_cloud_api.
 *
 * Real sending requires:
 *   ENABLE_REAL_WHATSAPP_SEND=true
 *   WHATSAPP_PROVIDER=meta_cloud_api
 *   META_WHATSAPP_ACCESS_TOKEN
 *   META_WHATSAPP_PHONE_NUMBER_ID
 *
 * Test mode (WHATSAPP_TEST_MODE=true):
 *   Real sends are allowed ONLY to WHATSAPP_TEST_PHONE.
 *   Any other recipient is blocked and stored with TEST_MODE_BLOCKED_REASON.
 *   Test mode wraps the real provider — it does not replace it.
 */

import { createMetaCloudApiProvider } from "./meta-cloud-api";

export interface SendMessageParams {
  businessId: string;
  toPhone: string;
  /** Provider-approved template name (required for real sends) */
  templateId?: string;
  /** BCP 47 language code matching the approved template (e.g. "he") */
  templateLanguage?: string;
  /** Positional body variables keyed "1", "2", … matched to template {{1}}, {{2}}, … */
  templateVariables?: Record<string, string>;
  /** Plain-text fallback used by mock/log and manual-copy flows */
  fallbackText: string;
  automationRunId: string;
  clientId: string;
}

export interface SendMessageResult {
  success: boolean;
  /** Provider-assigned message id (null for dev mock) */
  providerMessageId: string | null;
  /** Human-readable failure reason when success=false */
  failureReason?: string;
  /**
   * True when the provider is the dev mock — the message was NOT sent.
   * Caller should record status=skipped rather than sent/failed so dev runs
   * are never counted in real-sent stats.
   */
  isMockSkip?: boolean;
  /**
   * True when the message was blocked by test mode (recipient is not the
   * designated test phone). Caller should record status=skipped.
   */
  isTestModeBlock?: boolean;
}

export interface WhatsAppProvider {
  name: string;
  send(params: SendMessageParams): Promise<SendMessageResult>;
}

// ---------------------------------------------------------------------------
// Dev-safe mock provider
// ---------------------------------------------------------------------------

export const DEV_MOCK_SKIP_REASON =
  "מצב פיתוח — הודעה לא נשלחה בפועל";

const devMockProvider: WhatsAppProvider = {
  name: "dev_mock",
  async send(params) {
    console.log(
      `[WhatsApp dev_mock] NOT SENT — businessId=${params.businessId} to=${params.toPhone} runId=${params.automationRunId}\n` +
        `  text: ${params.fallbackText.slice(0, 120)}…`,
    );
    return {
      success: false,
      providerMessageId: null,
      failureReason: DEV_MOCK_SKIP_REASON,
      isMockSkip: true,
    };
  },
};

// ---------------------------------------------------------------------------
// Disabled provider — used when real sending is requested but misconfigured
// ---------------------------------------------------------------------------

const DISABLED_REASON = "חיבור WhatsApp לא מוגדר";

/** Returns a safe failure without attempting to send. */
function createDisabledProvider(reason = DISABLED_REASON): WhatsAppProvider {
  return {
    name: "disabled",
    async send() {
      return { success: false, providerMessageId: null, failureReason: reason };
    },
  };
}

// ---------------------------------------------------------------------------
// Test mode provider wrapper
// ---------------------------------------------------------------------------

export const TEST_MODE_BLOCKED_REASON =
  "מצב בדיקה — שליחה מותרת רק למספר הבדיקה";

/**
 * Wraps an inner provider so that real messages are only sent to
 * WHATSAPP_TEST_PHONE. Any other recipient is blocked and returns
 * isTestModeBlock=true so the caller can record it as skipped.
 *
 * Secrets (access token etc.) are never logged — only businessId,
 * clientId, provider name, and status.
 */
function createTestModeProvider(inner: WhatsAppProvider): WhatsAppProvider {
  return {
    name: `test_mode:${inner.name}`,
    async send(params) {
      const testPhone = process.env.WHATSAPP_TEST_PHONE;
      if (!testPhone) {
        console.warn(
          `[WhatsApp test_mode] WHATSAPP_TEST_PHONE not set — blocking send. businessId=${params.businessId} clientId=${params.clientId}`,
        );
        return {
          success: false,
          providerMessageId: null,
          failureReason: "WHATSAPP_TEST_PHONE לא מוגדר — שליחה נחסמה",
          isTestModeBlock: true,
        };
      }

      if (params.toPhone !== testPhone) {
        console.log(
          `[WhatsApp test_mode] BLOCKED — businessId=${params.businessId} clientId=${params.clientId} provider=${inner.name} status=blocked`,
        );
        return {
          success: false,
          providerMessageId: null,
          failureReason: TEST_MODE_BLOCKED_REASON,
          isTestModeBlock: true,
        };
      }

      // Recipient is the test phone — delegate to the real provider
      console.log(
        `[WhatsApp test_mode] ALLOWED — sending to test phone via ${inner.name}. businessId=${params.businessId} clientId=${params.clientId}`,
      );
      return inner.send(params);
    },
  };
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

/**
 * Returns the active WhatsApp provider.
 *
 * If ENABLE_REAL_WHATSAPP_SEND !== "true" → dev_mock (safe, no real sends).
 * If ENABLE_REAL_WHATSAPP_SEND=true and WHATSAPP_PROVIDER=meta_cloud_api →
 *   validates Meta credentials; returns metaCloudApiProvider or disabledProvider.
 * If WHATSAPP_TEST_MODE=true → wraps the real provider in a test mode guard.
 * Unknown/unconfigured provider → disabledProvider (fails safely, no real sends).
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  if (!realSendEnabled) {
    return devMockProvider;
  }

  const providerName = process.env.WHATSAPP_PROVIDER;
  let baseProvider: WhatsAppProvider;

  if (providerName === "meta_cloud_api") {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WHATSAPP_API_VERSION ?? "v19.0";

    if (!accessToken || !phoneNumberId) {
      console.error(
        "[WhatsApp] ENABLE_REAL_WHATSAPP_SEND=true but META_WHATSAPP_ACCESS_TOKEN or " +
          "META_WHATSAPP_PHONE_NUMBER_ID is missing. Falling back to disabled provider.",
      );
      baseProvider = createDisabledProvider(DISABLED_REASON);
    } else {
      baseProvider = createMetaCloudApiProvider({ accessToken, phoneNumberId, apiVersion });
    }
  } else {
    // Unknown or missing WHATSAPP_PROVIDER
    console.error(
      `[WhatsApp] ENABLE_REAL_WHATSAPP_SEND=true but WHATSAPP_PROVIDER="${providerName ?? ""}" is unknown. ` +
        "Use meta_cloud_api. Falling back to disabled provider.",
    );
    baseProvider = createDisabledProvider(DISABLED_REASON);
  }

  // Wrap with test mode guard if active
  if (process.env.WHATSAPP_TEST_MODE === "true") {
    return createTestModeProvider(baseProvider);
  }

  return baseProvider;
}

/** Returns true only when both ENABLE_REAL_WHATSAPP_SEND=true and Meta credentials are present. */
export function isRealSendConfigured(): boolean {
  return (
    process.env.ENABLE_REAL_WHATSAPP_SEND === "true" &&
    process.env.WHATSAPP_PROVIDER === "meta_cloud_api" &&
    !!process.env.META_WHATSAPP_ACCESS_TOKEN &&
    !!process.env.META_WHATSAPP_PHONE_NUMBER_ID
  );
}

/** Returns true when WHATSAPP_TEST_MODE=true. */
export function isTestModeActive(): boolean {
  return process.env.WHATSAPP_TEST_MODE === "true";
}

/** Returns true when WHATSAPP_TEST_PHONE is set (non-empty). */
export function isTestPhoneConfigured(): boolean {
  return !!process.env.WHATSAPP_TEST_PHONE;
}

export const DEV_MOCK_PROVIDER_NAME = "dev_mock";
