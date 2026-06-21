import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

// Mock eligibility so getWinBackAutomationData stays focused on the query module.
const getEligibleClients = vi.fn(async () => [] as unknown[]);
const getEligibilityBreakdown = vi.fn(async () => ({ eligible: 0 }) as unknown);
vi.mock("@/server/win-back-automation/eligibility", () => ({
  getEligibleClients: (...a: unknown[]) => getEligibleClients(...(a as [])),
  getEligibilityBreakdown: (...a: unknown[]) => getEligibilityBreakdown(...(a as [])),
}));

import { DEV_MOCK_SKIP_REASON } from "@/lib/whatsapp/provider";
import {
  getWinBackAutomationSetting,
  getWhatsAppConnection,
  getLastWinBackRun,
  getWinBackStatsThisMonth,
  getWinBackAutomationData,
  getAdminLastManualSends,
  getAdminAutomationInfo,
  getClientWinBackMessages,
} from "@/server/win-back-automation/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => {
  resetPrismaMock(prisma);
  getEligibleClients.mockReset().mockResolvedValue([]);
  getEligibilityBreakdown.mockReset().mockResolvedValue({ eligible: 0 });
});

describe("simple scoped getters", () => {
  it("getWinBackAutomationSetting scopes by business + win_back type", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({ id: "as_1" });
    await getWinBackAutomationSetting(tenant);
    expect(prisma.automationSetting.findUnique).toHaveBeenCalledWith({
      where: { businessId_type: { businessId: BUSINESS_A, type: "win_back" } },
    });
  });

  it("getWhatsAppConnection scopes by business", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    await getWhatsAppConnection(tenant);
    expect(prisma.whatsAppConnection.findUnique).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A },
    });
  });

  it("getLastWinBackRun scopes + orders desc", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({ id: "run_1" });
    await getLastWinBackRun(tenant);
    expect(prisma.automationRun.findFirst).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, type: "win_back" },
      orderBy: { startedAt: "desc" },
    });
  });
});

describe("getWinBackStatsThisMonth", () => {
  it("aggregates real/failed/mock/skipped counts and aliases sentThisMonth", async () => {
    prisma.automationMessage.count
      .mockResolvedValueOnce(7) // realSent
      .mockResolvedValueOnce(2) // failed
      .mockResolvedValueOnce(3) // mockRuns
      .mockResolvedValueOnce(1); // skipped (other)
    const stats = await getWinBackStatsThisMonth(tenant);
    expect(stats).toEqual({
      realSentThisMonth: 7,
      failedThisMonth: 2,
      mockRunsThisMonth: 3,
      skippedThisMonth: 1,
      sentThisMonth: 7,
    });

    // Every count is scoped by business + win_back type
    for (const call of prisma.automationMessage.count.mock.calls) {
      expect((call[0] as { where: { businessId: string; type: string } }).where.businessId).toBe(
        BUSINESS_A,
      );
      expect((call[0] as { where: { type: string } }).where.type).toBe("win_back");
    }
    // mock-run count uses the exact dev-mock skip reason
    const mockCall = prisma.automationMessage.count.mock.calls[2][0] as {
      where: { failureReason: string };
    };
    expect(mockCall.where.failureReason).toBe(DEV_MOCK_SKIP_REASON);
  });
});

describe("getWinBackAutomationData", () => {
  it("returns early (no eligibility calls) when there is no setting", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationRun.findFirst.mockResolvedValue(null);
    prisma.automationMessage.count.mockResolvedValue(0);

    const data = await getWinBackAutomationData(tenant);
    expect(data.setting).toBeNull();
    expect(data.eligibleCount).toBe(0);
    expect(data.breakdown).toBeNull();
    expect(data.sandboxTestPassed).toBe(false);
    expect(getEligibleClients).not.toHaveBeenCalled();
  });

  it("computes eligibility + sandbox flag when a setting exists", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({
      thresholdDays: 45,
      cooldownDays: 30,
      requireOptIn: true,
      testSendPassedAt: new Date("2026-06-01"),
    });
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationRun.findFirst.mockResolvedValue({ id: "run_1" });
    prisma.automationMessage.count.mockResolvedValue(0);
    getEligibleClients.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    getEligibilityBreakdown.mockResolvedValue({ eligible: 2 });

    const data = await getWinBackAutomationData(tenant);
    expect(data.eligibleCount).toBe(2);
    expect(data.breakdown).toEqual({ eligible: 2 });
    expect(data.sandboxTestPassed).toBe(true);
    expect(getEligibleClients).toHaveBeenCalledWith(tenant, {
      thresholdDays: 45,
      cooldownDays: 30,
      requireOptIn: true,
    });
  });
});

describe("getAdminLastManualSends", () => {
  it("returns masked phones and mapped fields scoped by business", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      {
        id: "m1",
        createdAt: new Date("2026-06-10"),
        clientId: "cli_1",
        type: "win_back",
        source: "manual_owner",
        status: "sent",
        providerMessageId: "wamid.1",
        failureReason: null,
        phone: "+972501234567",
        templateId: "tpl",
        sentAt: new Date("2026-06-10"),
        client: { fullName: "דנה" },
      },
    ]);
    const res = await getAdminLastManualSends(BUSINESS_A, 5);
    expect(res).toHaveLength(1);
    expect(res[0].clientName).toBe("דנה");
    expect(res[0].maskedPhone).toBe("972***567");

    const arg = prisma.automationMessage.findMany.mock.calls[0][0] as {
      where: { businessId: string; source: { in: string[] } };
      take: number;
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.source.in).toEqual(["manual_owner", "manual_admin"]);
    expect(arg.take).toBe(5);
  });

  it("masks short/invalid phones as ***", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      {
        id: "m1",
        createdAt: new Date(),
        clientId: "cli_1",
        type: "win_back",
        source: "manual_admin",
        status: "failed",
        providerMessageId: null,
        failureReason: "x",
        phone: "12",
        templateId: null,
        sentAt: null,
        client: { fullName: "א" },
      },
    ]);
    const res = await getAdminLastManualSends(BUSINESS_A);
    expect(res[0].maskedPhone).toBe("***");
  });
});

describe("getAdminAutomationInfo", () => {
  it("aggregates connection/setting/stats into the admin view scoped by business", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue({
      status: "active",
      provider: "meta_cloud_api",
      phoneNumber: "+972500000000",
      lastWebhookReceivedAt: new Date("2026-06-01"),
      lastDeliveryEventAt: new Date("2026-06-02"),
      lastReadEventAt: new Date("2026-06-03"),
    });
    prisma.automationSetting.findUnique.mockResolvedValue({
      enabled: true,
      templateName: "tpl",
    });
    prisma.automationMessage.count.mockResolvedValue(0);
    prisma.automationRun.findFirst.mockResolvedValue({ startedAt: new Date("2026-06-05") });
    prisma.automationMessage.findFirst.mockResolvedValue({ failureReason: "boom" });
    prisma.automationMessage.findMany.mockResolvedValue([]);

    const info = await getAdminAutomationInfo(BUSINESS_A);
    expect(info.whatsappConnected).toBe(true);
    expect(info.provider).toBe("meta_cloud_api");
    expect(info.automationEnabled).toBe(true);
    expect(info.templateConfigured).toBe(true);
    expect(info.lastFailureReason).toBe("boom");
    expect(info.lastWebhookReceivedAt).toBeInstanceOf(Date);
  });

  it("falls back to safe defaults when nothing is connected", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    prisma.automationMessage.count.mockResolvedValue(0);
    prisma.automationRun.findFirst.mockResolvedValue(null);
    prisma.automationMessage.findFirst.mockResolvedValue(null);
    prisma.automationMessage.findMany.mockResolvedValue([]);

    const info = await getAdminAutomationInfo(BUSINESS_A);
    expect(info.whatsappConnected).toBe(false);
    expect(info.provider).toBeNull();
    expect(info.automationEnabled).toBe(false);
    expect(info.templateConfigured).toBe(false);
    expect(info.lastFailureReason).toBeNull();
    expect(info.lastRunAt).toBeNull();
  });
});

describe("getClientWinBackMessages", () => {
  it("returns a client's win_back messages scoped by business + client, newest first", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([{ id: "m1" }]);
    const res = await getClientWinBackMessages(tenant, "cli_1");
    expect(res).toEqual([{ id: "m1" }]);
    expect(prisma.automationMessage.findMany).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, clientId: "cli_1", type: "win_back" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });
});
