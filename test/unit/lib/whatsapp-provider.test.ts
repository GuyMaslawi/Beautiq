import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWhatsAppProvider,
  isRealSendConfigured,
  isTestModeActive,
  isTestPhoneConfigured,
  devMockProvider,
  createDisabledProvider,
  createTestModeProvider,
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
  type WhatsAppProvider,
  type SendMessageParams,
} from "@/lib/whatsapp/provider";

function params(overrides: Partial<SendMessageParams> = {}): SendMessageParams {
  return {
    businessId: "biz_1",
    toPhone: "+972500000000",
    fallbackText: "hello",
    automationRunId: "run_1",
    clientId: "cli_1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("devMockProvider", () => {
  it("never sends and flags isMockSkip", async () => {
    const result = await devMockProvider.send(params());
    expect(result.success).toBe(false);
    expect(result.isMockSkip).toBe(true);
    expect(result.providerMessageId).toBeNull();
    expect(result.failureReason).toBe(DEV_MOCK_SKIP_REASON);
  });
});

describe("getWhatsAppProvider — env guard matrix", () => {
  it("returns dev_mock when real send is NOT enabled (default-safe)", () => {
    const p = getWhatsAppProvider();
    expect(p.name).toBe("dev_mock");
  });

  it("returns dev_mock even if provider+creds are set but real-send flag is off", () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pid";
    // ENABLE_REAL_WHATSAPP_SEND not "true"
    expect(getWhatsAppProvider().name).toBe("dev_mock");
  });

  it("returns disabled when real send enabled but provider unknown", () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "twilio"; // unknown
    expect(getWhatsAppProvider().name).toBe("disabled");
  });

  it("returns disabled when real send enabled but credentials missing", () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    // no token / phone number id
    expect(getWhatsAppProvider().name).toBe("disabled");
  });

  it("returns the meta provider when fully configured", () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pid";
    const p = getWhatsAppProvider();
    expect(p.name).toContain("meta");
    expect(p.name).not.toContain("test_mode");
  });

  it("wraps the real provider in a test-mode guard when WHATSAPP_TEST_MODE=true", () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pid";
    process.env.WHATSAPP_TEST_MODE = "true";
    expect(getWhatsAppProvider().name).toContain("test_mode");
  });
});

describe("isRealSendConfigured", () => {
  it("is false unless ALL real-send conditions are met", () => {
    expect(isRealSendConfigured()).toBe(false);

    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    expect(isRealSendConfigured()).toBe(false);

    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    expect(isRealSendConfigured()).toBe(false);

    process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
    expect(isRealSendConfigured()).toBe(false);

    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pid";
    expect(isRealSendConfigured()).toBe(true);
  });
});

describe("isTestModeActive / isTestPhoneConfigured", () => {
  it("reflects the env flags", () => {
    expect(isTestModeActive()).toBe(false);
    expect(isTestPhoneConfigured()).toBe(false);
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.WHATSAPP_TEST_PHONE = "+972500000000";
    expect(isTestModeActive()).toBe(true);
    expect(isTestPhoneConfigured()).toBe(true);
  });
});

describe("createDisabledProvider", () => {
  it("fails safely without sending", async () => {
    const result = await createDisabledProvider("nope").send(params());
    expect(result.success).toBe(false);
    expect(result.providerMessageId).toBeNull();
    expect(result.failureReason).toBe("nope");
  });
});

describe("createTestModeProvider", () => {
  function spyInner(): WhatsAppProvider {
    return {
      name: "meta_cloud_api",
      send: vi.fn(async () => ({ success: true, providerMessageId: "wamid.123" })),
    };
  }

  it("blocks sends when WHATSAPP_TEST_PHONE is not set", async () => {
    const inner = spyInner();
    const wrapped = createTestModeProvider(inner);
    const result = await wrapped.send(params({ toPhone: "+972511111111" }));
    expect(result.isTestModeBlock).toBe(true);
    expect(result.success).toBe(false);
    expect(inner.send).not.toHaveBeenCalled();
  });

  it("blocks sends to any number other than the test phone", async () => {
    process.env.WHATSAPP_TEST_PHONE = "+972500000000";
    const inner = spyInner();
    const wrapped = createTestModeProvider(inner);
    const result = await wrapped.send(params({ toPhone: "+972599999999" }));
    expect(result.isTestModeBlock).toBe(true);
    expect(result.failureReason).toBe(TEST_MODE_BLOCKED_REASON);
    expect(inner.send).not.toHaveBeenCalled();
  });

  it("delegates to the real provider ONLY for the exact test phone", async () => {
    process.env.WHATSAPP_TEST_PHONE = "+972500000000";
    const inner = spyInner();
    const wrapped = createTestModeProvider(inner);
    const result = await wrapped.send(params({ toPhone: "+972500000000" }));
    expect(inner.send).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe("wamid.123");
  });
});
