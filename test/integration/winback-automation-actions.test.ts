import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeBusiness, BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireCurrentBusiness = vi.fn();
const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: () => requireCurrentBusiness(),
  getCurrentUser: () => getCurrentUser(),
}));

// Provider send mocked — no real network.
type SendResult = { success: boolean; providerMessageId?: string; failureReason?: string };
const send = vi.fn(async (): Promise<SendResult> => ({
  success: true,
  providerMessageId: "wamid.1",
}));
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ send, name: "meta" })),
}));

// Runner mocked — winback-runner.test.ts already covers the runner itself.
const runWinBackForBusiness = vi.fn();
vi.mock("@/server/win-back-automation/runner", () => ({
  runWinBackForBusiness: (...a: unknown[]) => runWinBackForBusiness(...a),
}));

import {
  sendWhatsAppTestMessage,
  saveWinBackAutomationSetting,
  toggleWinBackAutomation,
  triggerWinBackRun,
  type SaveWinBackSettingInput,
} from "@/server/win-back-automation/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1", isAdmin: false });
  send.mockReset().mockResolvedValue({ success: true, providerMessageId: "wamid.1" });
  runWinBackForBusiness.mockReset();
  // Silence the action's console.log/error noise (restored globally in afterEach).
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function enableTestEnv() {
  process.env.WHATSAPP_TEST_MODE = "true";
  process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
  process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
  process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = "phone_1";
  process.env.WHATSAPP_TEST_PHONE = "+972544961155";
}

describe("sendWhatsAppTestMessage — env guards (no send)", () => {
  it("missing_test_mode", async () => {
    const res = await sendWhatsAppTestMessage();
    expect(res).toMatchObject({ success: false, errorCode: "missing_test_mode" });
    expect(send).not.toHaveBeenCalled();
  });

  it("missing_real_send", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    const res = await sendWhatsAppTestMessage();
    expect(res.errorCode).toBe("missing_real_send");
  });

  it("missing_provider", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    const res = await sendWhatsAppTestMessage();
    expect(res.errorCode).toBe("missing_provider");
  });

  it("missing_credentials", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    const res = await sendWhatsAppTestMessage();
    expect(res.errorCode).toBe("missing_credentials");
  });

  it("missing_test_phone", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.META_WHATSAPP_ACCESS_TOKEN = "tok";
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "phone_1";
    const res = await sendWhatsAppTestMessage();
    expect(res.errorCode).toBe("missing_test_phone");
  });

  it("missing_template when no approved template name is set", async () => {
    enableTestEnv();
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: null });
    const res = await sendWhatsAppTestMessage();
    expect(res.errorCode).toBe("missing_template");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("sendWhatsAppTestMessage — guarded send", () => {
  it("sends to the test phone only, logs run + records sandbox pass on success", async () => {
    enableTestEnv();
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "tpl",
      templateLanguage: "he",
      testSendPassedAt: null,
    });
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.automationSetting.update.mockResolvedValue({ id: "as_1" });

    const res = await sendWhatsAppTestMessage();
    expect(res.success).toBe(true);
    expect(res.providerMessageId).toBe("wamid.1");
    expect(send).toHaveBeenCalledTimes(1);

    const sendArg = (send.mock.calls[0] as unknown[])[0] as {
      businessId: string;
      toPhone: string;
    };
    expect(sendArg.businessId).toBe(BUSINESS_A);
    expect(sendArg.toPhone).toBe("+972544961155");

    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A, type: "win_back" }),
      }),
    );
    // sandbox pass recorded
    expect(prisma.automationSetting.update).toHaveBeenCalled();
  });

  it("returns provider_error (no secret) and marks run failed when provider fails", async () => {
    enableTestEnv();
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: "tpl", testSendPassedAt: null });
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    send.mockResolvedValue({ success: false, failureReason: "meta rejected" });

    const res = await sendWhatsAppTestMessage();
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("provider_error");
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("returns provider_error when an unexpected error is thrown", async () => {
    enableTestEnv();
    prisma.automationSetting.findUnique.mockRejectedValue(new Error("secret boom"));
    const res = await sendWhatsAppTestMessage();
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe("provider_error");
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});

describe("saveWinBackAutomationSetting", () => {
  const baseInput: SaveWinBackSettingInput = {
    enabled: true,
    thresholdDays: 45,
    sendHour: 10,
    messageTemplate: null,
    offerType: "none",
    offerValue: null,
    cooldownDays: 30,
    requireOptIn: true,
    templateName: null,
    templateLanguage: "he",
  };

  it("upserts scoped to the business and forces days mode for a non-admin in production", async () => {
    // In production a non-admin owner can never enable minute mode.
    vi.stubEnv("NODE_ENV", "production");
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await saveWinBackAutomationSetting({
      ...baseInput,
      timingUnit: "minutes",
      testThresholdMinutes: 5,
      testCooldownMinutes: 5,
    });
    expect(res.success).toBe(true);

    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      where: { businessId_type: { businessId: string } };
      update: { timingUnit: string; testThresholdMinutes: number | null };
    };
    expect(arg.where.businessId_type.businessId).toBe(BUSINESS_A);
    // Non-admin in production: minute mode dropped
    expect(arg.update.timingUnit).toBe("days");
    expect(arg.update.testThresholdMinutes).toBeNull();
    vi.unstubAllEnvs();
  });

  it("allows minute mode for an admin user", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getCurrentUser.mockResolvedValue({ id: "admin", isAdmin: true });
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    await saveWinBackAutomationSetting({
      ...baseInput,
      timingUnit: "minutes",
      testThresholdMinutes: 5,
      testCooldownMinutes: 7,
    });
    const arg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      update: { timingUnit: string; testThresholdMinutes: number | null };
    };
    expect(arg.update.timingUnit).toBe("minutes");
    expect(arg.update.testThresholdMinutes).toBe(5);
    vi.unstubAllEnvs();
  });

  it("returns a safe failure when the upsert throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await saveWinBackAutomationSetting(baseInput);
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain("secret");
  });
});

describe("toggleWinBackAutomation", () => {
  it("upserts enabled scoped to the business", async () => {
    prisma.automationSetting.upsert.mockResolvedValue({ id: "as_1" });
    const res = await toggleWinBackAutomation(true);
    expect(res.success).toBe(true);
    expect(prisma.automationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_type: { businessId: BUSINESS_A, type: "win_back" } },
        update: { enabled: true },
      }),
    );
  });

  it("returns a safe failure when the upsert throws", async () => {
    prisma.automationSetting.upsert.mockRejectedValue(new Error("secret db"));
    const res = await toggleWinBackAutomation(false);
    expect(res.success).toBe(false);
    expect(res.error).not.toContain("secret");
  });
});

describe("triggerWinBackRun", () => {
  it("delegates to the runner and returns its result", async () => {
    runWinBackForBusiness.mockResolvedValue({
      success: true,
      sentCount: 1,
      skippedCount: 0,
      failedCount: 0,
      mockSkipCount: 0,
    });
    const res = await triggerWinBackRun();
    expect(res.success).toBe(true);
    expect(res.sentCount).toBe(1);
    expect(runWinBackForBusiness).toHaveBeenCalledWith(makeBusiness({ id: BUSINESS_A }));
  });

  it("returns a safe zeroed failure when the runner throws", async () => {
    runWinBackForBusiness.mockRejectedValue(new Error("secret boom"));
    const res = await triggerWinBackRun();
    expect(res.success).toBe(false);
    expect(res.sentCount).toBe(0);
    expect(res.error).toBeTruthy();
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});
