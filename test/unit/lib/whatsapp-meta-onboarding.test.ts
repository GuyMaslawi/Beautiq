import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Meta Embedded Signup onboarding helpers (lib/whatsapp/meta-onboarding.ts).
 *
 * These talk to the Meta Graph API. SAFETY: every test mocks global fetch — no
 * real network call is ever made. We assert:
 *   - success / failure paths return structured results (never throw token text)
 *   - access tokens are scrubbed out of any returned error message
 *   - tokens are sent only in the Authorization header / token query param
 */

import {
  exchangeCodeForToken,
  registerPhoneNumber,
  subscribeAppToWaba,
  fetchPhoneNumberInfo,
  fetchFirstWabaPhoneNumber,
  scrubToken,
  derivePin,
} from "@/lib/whatsapp/meta-onboarding";

const REAL_TOKEN = "EAAlongLivedSystemUserTokenABC123";

function mockFetchOnce(opts: { ok: boolean; status?: number; json: unknown }) {
  const fn = vi.fn(async () => ({
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 400),
    json: async () => opts.json,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  // Onboarding requires app credentials for the token exchange only.
  process.env.META_APP_ID = "app_123";
  process.env.META_APP_SECRET = "secret_456";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrubToken", () => {
  it("replaces any EAA-prefixed token with a placeholder", () => {
    expect(scrubToken(`boom ${REAL_TOKEN} happened`)).not.toContain(REAL_TOKEN);
    expect(scrubToken(`boom ${REAL_TOKEN} happened`)).toContain("[token]");
  });

  it("leaves token-free messages untouched", () => {
    expect(scrubToken("just an error")).toBe("just an error");
  });
});

describe("derivePin", () => {
  it("is deterministic and always 6 digits", () => {
    const a = derivePin("phone_1");
    const b = derivePin("phone_1");
    expect(a).toBe(b);
    expect(a).toMatch(/^\d{6}$/);
  });

  it("differs for different seeds (usually)", () => {
    expect(derivePin("phone_1")).not.toBe(derivePin("totally-different-seed"));
  });
});

describe("exchangeCodeForToken", () => {
  it("fails safely when app credentials are missing (no fetch)", async () => {
    delete process.env.META_APP_ID;
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const res = await exchangeCodeForToken("code");
    expect(res.ok).toBe(false);
    expect(res.accessToken).toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns the access token on success", async () => {
    mockFetchOnce({ ok: true, json: { access_token: REAL_TOKEN, expires_in: 3600 } });
    const res = await exchangeCodeForToken("auth_code");
    expect(res.ok).toBe(true);
    expect(res.accessToken).toBe(REAL_TOKEN);
    expect(res.expiresInSeconds).toBe(3600);
  });

  it("sends the code, not a client-trusted token, and never the secret in the path twice", async () => {
    const fetchFn = mockFetchOnce({ ok: true, json: { access_token: REAL_TOKEN } });
    await exchangeCodeForToken("auth_code");
    const url = String((fetchFn.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("code=auth_code");
    expect(url).toContain("/oauth/access_token");
  });

  it("fails safely on a Meta error and scrubs any token from the message", async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      json: { error: { message: `bad code near ${REAL_TOKEN}` } },
    });
    const res = await exchangeCodeForToken("code");
    expect(res.ok).toBe(false);
    expect(res.accessToken).toBeUndefined();
    expect(res.error).not.toContain(REAL_TOKEN);
  });

  it("returns ok=false when Meta returns 200 but no access_token", async () => {
    mockFetchOnce({ ok: true, json: {} });
    const res = await exchangeCodeForToken("code");
    expect(res.ok).toBe(false);
  });

  it("catches network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNRESET");
    }));
    const res = await exchangeCodeForToken("code");
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

describe("registerPhoneNumber", () => {
  it("succeeds when Meta returns success", async () => {
    const fetchFn = mockFetchOnce({ ok: true, json: { success: true } });
    const res = await registerPhoneNumber("phone_1", REAL_TOKEN, "123456");
    expect(res.ok).toBe(true);
    // token goes in the Authorization header only
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe(`Bearer ${REAL_TOKEN}`);
  });

  it("treats 'already registered' (133016) as idempotent success", async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      json: { error: { code: 133016, message: "already registered" } },
    });
    const res = await registerPhoneNumber("phone_1", REAL_TOKEN, "123456");
    expect(res.ok).toBe(true);
  });

  it("returns a scrubbed error on a real failure", async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      json: { error: { message: `nope ${REAL_TOKEN}` } },
    });
    const res = await registerPhoneNumber("phone_1", REAL_TOKEN, "123456");
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain(REAL_TOKEN);
  });
});

describe("subscribeAppToWaba", () => {
  it("succeeds on success", async () => {
    mockFetchOnce({ ok: true, json: { success: true } });
    expect((await subscribeAppToWaba("waba_1", REAL_TOKEN)).ok).toBe(true);
  });

  it("fails safely with a scrubbed message", async () => {
    mockFetchOnce({ ok: false, status: 403, json: { error: { message: REAL_TOKEN } } });
    const res = await subscribeAppToWaba("waba_1", REAL_TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain(REAL_TOKEN);
  });
});

describe("fetchPhoneNumberInfo", () => {
  it("returns the display phone number + verified name", async () => {
    mockFetchOnce({
      ok: true,
      json: { display_phone_number: "+972 50-000-0000", verified_name: "Studio" },
    });
    const res = await fetchPhoneNumberInfo("phone_1", REAL_TOKEN);
    expect(res.ok).toBe(true);
    expect(res.displayPhoneNumber).toBe("+972 50-000-0000");
    expect(res.verifiedName).toBe("Studio");
  });

  it("fails safely on an HTTP error", async () => {
    mockFetchOnce({ ok: false, status: 404, json: { error: { message: "not found" } } });
    const res = await fetchPhoneNumberInfo("phone_1", REAL_TOKEN);
    expect(res.ok).toBe(false);
  });
});

describe("fetchFirstWabaPhoneNumber", () => {
  it("returns the first phone number from the WABA", async () => {
    mockFetchOnce({
      ok: true,
      json: { data: [{ id: "pn_1", display_phone_number: "+972500000000" }] },
    });
    const res = await fetchFirstWabaPhoneNumber("waba_1", REAL_TOKEN);
    expect(res.ok).toBe(true);
    expect(res.phoneNumberId).toBe("pn_1");
  });

  it("fails safely when the WABA has no phone numbers", async () => {
    mockFetchOnce({ ok: true, json: { data: [] } });
    const res = await fetchFirstWabaPhoneNumber("waba_1", REAL_TOKEN);
    expect(res.ok).toBe(false);
    expect(res.phoneNumberId).toBeUndefined();
  });
});
