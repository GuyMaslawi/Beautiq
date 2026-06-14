import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * SECURITY-CRITICAL: the Meta Cloud API + Templates + Onboarding helpers are the
 * only code that performs real network calls with the access token. These tests:
 *   - Mock global fetch so NO real request ever leaves the machine.
 *   - Assert the token only ever appears in the Authorization header (never in
 *     the URL, body, or any console log).
 *   - Assert success/failure shaping and safe Hebrew failure reasons.
 */

import { createMetaCloudApiProvider } from "@/lib/whatsapp/meta-cloud-api";
import { createTemplate, listTemplates } from "@/lib/whatsapp/meta-templates-api";
import {
  exchangeCodeForToken,
  registerPhoneNumber,
  scrubToken,
} from "@/lib/whatsapp/meta-onboarding";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";

const REAL_TOKEN = "EAAsuper-secret-meta-token-abcdef-123456";

let fetchSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as typeof fetchSpy;
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedText(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls]
    .map((c) => c.map((x) => String(x)).join(" "))
    .join("\n");
}

/** Asserts the token only appears in the Authorization header of fetch calls. */
function assertTokenOnlyInAuthHeader(): void {
  expect(loggedText()).not.toContain(REAL_TOKEN);
  for (const call of fetchSpy.mock.calls) {
    const url = String(call[0]);
    const init = (call[1] ?? {}) as RequestInit;
    expect(url).not.toContain(REAL_TOKEN);
    if (init.body) expect(String(init.body)).not.toContain(REAL_TOKEN);
    const headers = (init.headers ?? {}) as Record<string, string>;
    if (headers.Authorization) {
      expect(headers.Authorization).toBe(`Bearer ${REAL_TOKEN}`);
    }
  }
}

describe("meta-cloud-api send()", () => {
  const provider = createMetaCloudApiProvider({
    accessToken: REAL_TOKEN,
    phoneNumberId: "phone_123",
    apiVersion: "v19.0",
  });

  const baseParams = {
    businessId: "biz_a",
    toPhone: "+972501112222",
    templateId: "booking_confirmation_he",
    templateLanguage: "he",
    templateVariables: { "1": "דנה", "2": "מניקור" },
    fallbackText: "fallback",
    automationRunId: "run_1",
    clientId: "cli_1",
  };

  it("builds correct request and returns providerMessageId on 200", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ messaging_product: "whatsapp", messages: [{ id: "wamid.ABC" }] }, 200),
    );

    const res = await provider.send(baseParams);

    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe("wamid.ABC");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/v19.0/phone_123/messages");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse(String((init as RequestInit).body));
    // E.164 without leading '+'
    expect(body.to).toBe("972501112222");
    expect(body.template.name).toBe("booking_confirmation_he");
    expect(body.template.language.code).toBe("he");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "דנה" },
      { type: "text", text: "מניקור" },
    ]);
    assertTokenOnlyInAuthHeader();
  });

  it("returns success:false with safe reason on an error response, never logs token", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { error: { message: "Invalid template", type: "OAuthException", code: 132 } },
        400,
      ),
    );

    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.providerMessageId).toBeNull();
    expect(res.failureReason).toBe("Invalid template");
    assertTokenOnlyInAuthHeader();
  });

  it("returns safe failure on a network error (fetch throws)", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNRESET"));
    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.failureReason).toBe("ECONNRESET");
    assertTokenOnlyInAuthHeader();
  });

  it("returns failure when templateId is missing without any fetch", async () => {
    const res = await provider.send({ ...baseParams, templateId: undefined });
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns safe failure when the response body is not valid JSON", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.failureReason).toContain("HTTP 200");
  });
});

describe("meta-templates-api", () => {
  const tpl = DEFAULT_TEMPLATES[0];

  it("createTemplate returns ok+id on success, token only in Authorization header", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ id: "tpl_1", status: "PENDING" }, 200));
    const res = await createTemplate("waba_1", REAL_TOKEN, tpl);
    expect(res.ok).toBe(true);
    expect(res.id).toBe("tpl_1");
    expect(res.status).toBe("pending");
    assertTokenOnlyInAuthHeader();
  });

  it("createTemplate treats 'already exists' as success (idempotent)", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: { message: "template name already exists" } }, 400),
    );
    const res = await createTemplate("waba_1", REAL_TOKEN, tpl);
    expect(res.ok).toBe(true);
    expect(res.alreadyExists).toBe(true);
  });

  it("createTemplate returns scrubbed error on genuine failure", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: { message: `bad token ${REAL_TOKEN}` } }, 401),
    );
    const res = await createTemplate("waba_1", REAL_TOKEN, tpl);
    expect(res.ok).toBe(false);
    // scrubToken replaces EAA-prefixed tokens with [token].
    expect(res.error).not.toContain(REAL_TOKEN);
    expect(res.error).toContain("[token]");
  });

  it("listTemplates normalizes statuses", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: [
          { name: "a", language: "he", status: "APPROVED" },
          { name: "b", language: "he", status: "REJECTED" },
          { name: "c", language: "he", status: "PENDING" },
        ],
      }),
    );
    const res = await listTemplates("waba_1", REAL_TOKEN);
    expect(res.ok).toBe(true);
    expect(res.templates?.map((t) => t.status)).toEqual(["approved", "rejected", "pending"]);
    assertTokenOnlyInAuthHeader();
  });

  it("listTemplates returns scrubbed error on HTTP failure", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: { message: `EAAbadtoken` } }, 500));
    const res = await listTemplates("waba_1", REAL_TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain("EAAbadtoken");
  });
});

describe("meta-onboarding helpers", () => {
  it("scrubToken removes EAA-prefixed tokens", () => {
    expect(scrubToken(`error with ${REAL_TOKEN} inside`)).not.toContain(REAL_TOKEN);
    expect(scrubToken(`error with ${REAL_TOKEN} inside`)).toContain("[token]");
  });

  it("exchangeCodeForToken fails fast without META_APP_ID/SECRET (no fetch)", async () => {
    const res = await exchangeCodeForToken("auth_code");
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("exchangeCodeForToken returns the token on success but never logs it", async () => {
    process.env.META_APP_ID = "app_1";
    process.env.META_APP_SECRET = "secret_1";
    fetchSpy.mockResolvedValue(jsonResponse({ access_token: REAL_TOKEN, expires_in: 3600 }));

    const res = await exchangeCodeForToken("auth_code");
    expect(res.ok).toBe(true);
    expect(res.accessToken).toBe(REAL_TOKEN);
    expect(res.expiresInSeconds).toBe(3600);
    // The token must not be logged.
    expect(loggedText()).not.toContain(REAL_TOKEN);
  });

  it("registerPhoneNumber treats code 133016 (already registered) as success", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: { code: 133016, message: "x" } }, 400));
    const res = await registerPhoneNumber("phone_1", REAL_TOKEN, "123456");
    expect(res.ok).toBe(true);
    assertTokenOnlyInAuthHeader();
  });

  it("registerPhoneNumber returns scrubbed error on real failure", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: { code: 100, message: `nope ${REAL_TOKEN}` } }, 400),
    );
    const res = await registerPhoneNumber("phone_1", REAL_TOKEN, "123456");
    expect(res.ok).toBe(false);
    expect(res.error).not.toContain(REAL_TOKEN);
  });
});
