/**
 * Meta Embedded Signup — server-side onboarding helpers.
 *
 * These functions talk to the Meta Graph API to complete the technical steps
 * of connecting a business's WhatsApp Business Account (WABA) after the owner
 * finishes the Embedded Signup popup in the browser.
 *
 * Flow (orchestrated by completeEmbeddedSignup in the server action):
 *   1. exchangeCodeForToken  — turn the authorization code into a long-lived
 *                              business-integration system-user access token.
 *   2. registerPhoneNumber   — register the number for Cloud API (idempotent).
 *   3. subscribeAppToWaba    — subscribe our app to the WABA for webhooks.
 *   4. fetchPhoneNumberInfo  — read the display phone number + verified name.
 *
 * SAFETY:
 *   - The access token is only ever sent in the Authorization header / token
 *     query param to Meta. It is never logged. Errors are scrubbed of tokens.
 *   - All helpers return structured results; they never throw token content.
 */

const META_GRAPH_BASE = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.META_WHATSAPP_API_VERSION ?? "v19.0";
}

/** Removes Meta access-token-looking strings from any message before logging/saving. */
export function scrubToken(message: string): string {
  return message.replace(/EAA\S+/g, "[token]");
}

interface TokenExchangeResult {
  ok: boolean;
  accessToken?: string;
  /** Seconds until expiry, if Meta returns one (system-user tokens are usually long-lived). */
  expiresInSeconds?: number;
  error?: string;
}

/**
 * Exchanges the Embedded Signup authorization code for a business access token.
 * Requires META_APP_ID and META_APP_SECRET.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { ok: false, error: "META_APP_ID / META_APP_SECRET חסרים בהגדרות השרת" };
  }

  const url =
    `${META_GRAPH_BASE}/${apiVersion()}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };
    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        error: scrubToken(data.error?.message ?? `HTTP ${res.status}`),
      };
    }
    return {
      ok: true,
      accessToken: data.access_token,
      expiresInSeconds: data.expires_in,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת",
    };
  }
}

interface SimpleResult {
  ok: boolean;
  error?: string;
}

/**
 * Registers the phone number with Cloud API. Idempotent: a number that is
 * already registered returns ok=true. Uses a deterministic 6-digit PIN derived
 * from the phone number id (Meta does not let us read it back, so we only need
 * it to be stable for this registration call).
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin: string,
): Promise<SimpleResult> {
  const url = `${META_GRAPH_BASE}/${apiVersion()}/${phoneNumberId}/register`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      error?: { message?: string; code?: number };
    };
    if (res.ok && data.success) return { ok: true };

    // 133016 / "already registered" → treat as success (idempotent).
    const msg = data.error?.message ?? "";
    if (
      data.error?.code === 133016 ||
      /already.*registered|already been registered/i.test(msg)
    ) {
      return { ok: true };
    }
    return { ok: false, error: scrubToken(msg || `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}

/** Subscribes our app to the WABA so we receive message/status webhooks. */
export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string,
): Promise<SimpleResult> {
  const url = `${META_GRAPH_BASE}/${apiVersion()}/${wabaId}/subscribed_apps`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      error?: { message?: string };
    };
    if (res.ok && data.success) return { ok: true };
    return { ok: false, error: scrubToken(data.error?.message ?? `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}

interface PhoneInfoResult {
  ok: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  error?: string;
}

/** Reads the display phone number + verified name for a phone number id. */
export async function fetchPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string,
): Promise<PhoneInfoResult> {
  const url =
    `${META_GRAPH_BASE}/${apiVersion()}/${phoneNumberId}` +
    `?fields=display_phone_number,verified_name`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: scrubToken(data.error?.message ?? `HTTP ${res.status}`) };
    }
    return {
      ok: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}

interface WabaPhoneNumbersResult {
  ok: boolean;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  error?: string;
}

/**
 * Fallback when the browser did not return a phone_number_id: list the WABA's
 * phone numbers and pick the first one.
 */
export async function fetchFirstWabaPhoneNumber(
  wabaId: string,
  accessToken: string,
): Promise<WabaPhoneNumbersResult> {
  const url =
    `${META_GRAPH_BASE}/${apiVersion()}/${wabaId}/phone_numbers` +
    `?fields=id,display_phone_number`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await res.json()) as {
      data?: Array<{ id: string; display_phone_number?: string }>;
      error?: { message?: string };
    };
    if (!res.ok || !data.data?.length) {
      return {
        ok: false,
        error: scrubToken(data.error?.message ?? "לא נמצאו מספרי טלפון ב-WABA"),
      };
    }
    const first = data.data[0];
    return {
      ok: true,
      phoneNumberId: first.id,
      displayPhoneNumber: first.display_phone_number,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? scrubToken(err.message) : "שגיאת רשת" };
  }
}

/** Builds a deterministic, stable 6-digit registration PIN from an id. */
export function derivePin(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_000;
  }
  return String(hash).padStart(6, "0");
}
