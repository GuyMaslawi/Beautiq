import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Branch coverage for runWinBackForBusiness beyond the dev-mock suite:
 * the real-send template guard, the test-mode-without-test-phone guard, the
 * in-loop invalid-phone skip, and the provider result branches (sent / failed /
 * test-mode-block) via a controllable resolver.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

const send = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ name: "stub", send })),
}));

// Mock eligibility so we control the exact eligible set (including a row whose
// phone is invalid — unreachable via the real eligibility query, which shares
// the same +972 validation as the runner's in-loop guard).
const getEligibleClients = vi.fn();
vi.mock("@/server/win-back-automation/eligibility", () => ({
  getEligibleClients: (...a: unknown[]) => getEligibleClients(...a),
}));

import { runWinBackForBusiness } from "@/server/win-back-automation/runner";

function eligibleResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "cli_1",
    fullName: "עדי לוי",
    phone: "050-123-4567",
    normalizedPhone: "+972501234567",
    whatsappOptIn: true,
    lastVisitAt: new Date("2026-01-01T09:00:00Z"),
    lastServiceName: "מניקור",
    lastBookingId: "bkg_old",
    daysSinceLastVisit: 100,
    totalCompletedBookings: 1,
    totalRevenue: 200,
    ...overrides,
  };
}

const BUSINESS = { id: BUSINESS_A, name: "סטודיו יופי", slug: "studio-yofi" };

function enabledSetting(overrides: Record<string, unknown> = {}) {
  return {
    businessId: BUSINESS_A,
    type: "win_back",
    enabled: true,
    thresholdDays: 45,
    cooldownDays: 30,
    requireOptIn: true,
    offerType: "discount_10",
    offerValue: null,
    messageTemplate: null,
    templateName: null,
    templateLanguage: "he",
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset();
  getEligibleClients.mockReset().mockResolvedValue([]);
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  delete process.env.WHATSAPP_TEST_MODE;
  delete process.env.WHATSAPP_TEST_PHONE;
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
  prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
  prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "msg_1", ...a.data }));
  prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runWinBackForBusiness — real-send / test-mode guards", () => {
  it("errors when real send is on but no Meta templateName is configured (no run created)", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: null }));
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.success).toBe(false);
    expect(res.error).toContain("תבנית WhatsApp");
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it("errors when test mode is active but WHATSAPP_TEST_PHONE is unset", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    process.env.WHATSAPP_TEST_MODE = "true";
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: "winback_he" }));
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.success).toBe(false);
    expect(res.error).toContain("WHATSAPP_TEST_PHONE");
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });
});

describe("runWinBackForBusiness — in-loop branches", () => {
  it("skips an eligible client whose phone is invalid inside the loop", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    // Eligibility returns the client, but the runner's isValidIsraeliPhone rejects it.
    getEligibleClients.mockResolvedValue([
      eligibleResult({ id: "cli_bad", normalizedPhone: "not-a-phone" }),
    ]);
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.skippedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped", failureReason: "מספר טלפון לא תקין" }) }),
    );
  });

  it("marks a message sent when the provider reports success", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: "winback_he" }));
    getEligibleClients.mockResolvedValue([
      eligibleResult({ id: "c1", normalizedPhone: "+972501111111" }),
    ]);
    send.mockResolvedValue({ success: true, providerMessageId: "wamid.W" });
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.sentCount).toBe(1);
    expect(res.failedCount).toBe(0);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent", providerMessageId: "wamid.W" }) }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }),
    );
    // hello_world special-case NOT triggered → 2 positional vars passed.
    const arg = send.mock.calls[0][0] as { templateVariables: Record<string, string> };
    expect(arg.templateVariables["1"]).toBeTruthy();
    expect(arg.templateVariables["2"]).toBe("סטודיו יופי");
  });

  it("sends hello_world with NO template variables (zero-variable sandbox template)", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: "hello_world" }));
    getEligibleClients.mockResolvedValue([
      eligibleResult({ id: "c1", normalizedPhone: "+972501111111" }),
    ]);
    send.mockResolvedValue({ success: true, providerMessageId: "wamid.H" });
    await runWinBackForBusiness(BUSINESS);
    const arg = send.mock.calls[0][0] as { templateVariables: undefined };
    expect(arg.templateVariables).toBeUndefined();
  });

  it("records a failed message and a failed run when the provider fails for the only client", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: "winback_he" }));
    getEligibleClients.mockResolvedValue([
      eligibleResult({ id: "c1", normalizedPhone: "+972501111111" }),
    ]);
    send.mockResolvedValue({ success: false, failureReason: "rejected" });
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.failedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", failureReason: "rejected" }) }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("marks a message skipped when the provider reports a test-mode block", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ templateName: "winback_he" }));
    getEligibleClients.mockResolvedValue([
      eligibleResult({ id: "c1", normalizedPhone: "+972501111111" }),
    ]);
    send.mockResolvedValue({ success: false, isTestModeBlock: true });
    const res = await runWinBackForBusiness(BUSINESS);
    expect(res.skippedCount).toBe(1);
    expect(res.sentCount).toBe(0);
    expect(res.failedCount).toBe(0);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
  });
});
