import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Additional coverage for meta-cloud-api.ts targeting branches the main suite
 * does not exercise:
 *  - buildMetaErrorReason default message + no-diagnostic-fields path
 *  - the 131008 ("Required parameter missing") template-definition debug fetch,
 *    both with WABA_ID set (second fetch succeeds AND throws) and unset
 *  - a template with no variables → payload omits the components block
 *  - success response with no messages[] → providerMessageId is null
 */

import {
  createMetaCloudApiProvider,
  buildMetaErrorReason,
} from "@/lib/whatsapp/meta-cloud-api";

const REAL_TOKEN = "EAAsuper-secret-meta-token-abcdef-123456";

let fetchSpy: ReturnType<typeof vi.spyOn>;

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
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const provider = createMetaCloudApiProvider({
  accessToken: REAL_TOKEN,
  phoneNumberId: "phone_123",
  apiVersion: "v19.0",
});

const baseParams = {
  businessId: "biz_a",
  toPhone: "972501112222",
  templateId: "tpl_he",
  templateLanguage: "he",
  templateVariables: { "1": "דנה" },
  fallbackText: "fallback",
  automationRunId: "run_1",
  clientId: "cli_1",
};

describe("buildMetaErrorReason", () => {
  it("falls back to a Hebrew status message when no message is present", () => {
    expect(buildMetaErrorReason(undefined, 503)).toBe("Meta API שגיאה 503");
  });

  it("returns just the message when no diagnostic fields are present", () => {
    expect(buildMetaErrorReason({ message: "פשוט נכשל" }, 400)).toBe("פשוט נכשל");
  });

  it("appends every diagnostic field present (code/type/subcode/trace)", () => {
    const reason = buildMetaErrorReason(
      { message: "bad", code: 131008, type: "OAuthException", error_subcode: 99, fbtrace_id: "TR1" },
      400,
    );
    expect(reason).toContain("code 131008");
    expect(reason).toContain("type OAuthException");
    expect(reason).toContain("subcode 99");
    expect(reason).toContain("trace TR1");
  });
});

describe("meta-cloud-api send() — extra branches", () => {
  it("omits the template components block when there are no variables", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.X" }] }, 200));
    const res = await provider.send({ ...baseParams, templateVariables: undefined });
    expect(res.success).toBe(true);
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.template.components).toBeUndefined();
    // E.164 without '+' passes through unchanged when there is no leading '+'
    expect(body.to).toBe("972501112222");
  });

  it("strips a leading '+' from the recipient phone", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.Y" }] }, 200));
    await provider.send({ ...baseParams, toPhone: "+972501112222" });
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body.to).toBe("972501112222");
  });

  it("returns success with null providerMessageId when messages[] is absent", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ messaging_product: "whatsapp" }, 200));
    const res = await provider.send(baseParams);
    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBeNull();
  });

  it("on error 131008 with WABA_ID set, fetches the template definition for debug", async () => {
    process.env.META_WHATSAPP_WABA_ID = "waba_debug_1";
    fetchSpy
      // 1st call: the send → 131008 error
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "Required parameter missing", code: 131008 } }, 400),
      )
      // 2nd call: fetchTemplateDefinition
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: "tpl_he", components: [] }] }, 200));

    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.failureReason).toContain("code 131008");
    // The debug definition fetch happened (2 total fetches) and hit the WABA template endpoint.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain("waba_debug_1/message_templates");
  });

  it("on error 131008 with the debug fetch throwing, still returns the safe failure", async () => {
    process.env.META_WHATSAPP_WABA_ID = "waba_debug_2";
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "Required parameter missing", code: 131008 } }, 400),
      )
      // fetchTemplateDefinition rejects — its internal try/catch swallows it.
      .mockRejectedValueOnce(new Error("definition fetch failed"));

    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.failureReason).toContain("131008");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("on error 131008 without WABA_ID, skips the debug fetch", async () => {
    delete process.env.META_WHATSAPP_WABA_ID;
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Required parameter missing", code: 131008 } }, 400),
    );
    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    // Only the original send fetch — no template-definition fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("treats a body.error present on a 200 response as a failure", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ messages: [{ id: "x" }], error: { message: "soft error", code: 10 } }, 200),
    );
    const res = await provider.send(baseParams);
    expect(res.success).toBe(false);
    expect(res.failureReason).toContain("soft error");
  });
});
