import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestModeProvider, type WhatsAppProvider } from "@/lib/whatsapp/provider";

/**
 * SECURITY-CRITICAL: in WHATSAPP_TEST_MODE the test-mode wrapper must allow a
 * real send ONLY to WHATSAPP_TEST_PHONE — and it must match the recipient
 * regardless of phone format (+972…, 972…, 0…). A previous exact-string match
 * blocked even the test number itself when callers passed the non-"+" form.
 */

let sent: Array<{ toPhone: string }>;
let inner: WhatsAppProvider;

beforeEach(() => {
  sent = [];
  inner = {
    name: "meta_cloud_api",
    async send(params) {
      sent.push({ toPhone: params.toPhone });
      return { success: true, providerMessageId: "wamid.TEST" };
    },
  };
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function call(toPhone: string) {
  const provider = createTestModeProvider(inner);
  return provider.send({
    businessId: "biz",
    toPhone,
    templateId: "t",
    fallbackText: "hi",
    automationRunId: "run",
    clientId: "cli",
  });
}

describe("createTestModeProvider", () => {
  it("allows a send to the test phone even when recipient has no '+' prefix", async () => {
    process.env.WHATSAPP_TEST_PHONE = "+972544961155";
    const res = await call("972544961155"); // toWaPhone() format (no +)
    expect(res.success).toBe(true);
    expect(sent).toHaveLength(1);
    expect(res.isTestModeBlock).toBeUndefined();
  });

  it("allows a send to the test phone in local 0-prefixed format", async () => {
    process.env.WHATSAPP_TEST_PHONE = "+972544961155";
    const res = await call("0544961155");
    expect(res.success).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("blocks a send to any other recipient", async () => {
    process.env.WHATSAPP_TEST_PHONE = "+972544961155";
    const res = await call("+972501234567");
    expect(res.success).toBe(false);
    expect(res.isTestModeBlock).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("blocks all sends when WHATSAPP_TEST_PHONE is not set", async () => {
    delete process.env.WHATSAPP_TEST_PHONE;
    const res = await call("972544961155");
    expect(res.success).toBe(false);
    expect(res.isTestModeBlock).toBe(true);
    expect(sent).toHaveLength(0);
  });
});
