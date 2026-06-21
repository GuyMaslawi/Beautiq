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

import {
  getAutomationMessageLog,
  getWhatsAppActivityStats,
} from "@/server/automations/message-queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getAutomationMessageLog", () => {
  it("scopes by tenant, applies default limit, orders newest first, maps shape", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      {
        id: "msg_1",
        type: "win_back",
        status: "sent",
        bookingId: "bkg_1",
        failureReason: null,
        sentAt: new Date("2026-06-10T08:00:00Z"),
        failedAt: null,
        createdAt: new Date("2026-06-10T07:59:00Z"),
        retryCount: 0,
        lastRetryAt: null,
        client: { id: "cli_1", fullName: "עדי לוי" },
      },
    ]);
    const res = await getAutomationMessageLog(TENANT);
    expect(prisma.automationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
    expect(res[0]).toMatchObject({
      id: "msg_1",
      clientName: "עדי לוי",
      clientId: "cli_1",
      bookingId: "bkg_1",
      status: "sent",
    });
  });

  it("honors a custom limit", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([]);
    await getAutomationMessageLog(TENANT, { limit: 5 });
    const arg = prisma.automationMessage.findMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(5);
  });
});

describe("getWhatsAppActivityStats", () => {
  it("scopes every count/find by tenant and aggregates the weekly counters", async () => {
    prisma.automationMessage.count
      .mockResolvedValueOnce(7) // sentThisWeek
      .mockResolvedValueOnce(5) // deliveredThisWeek
      .mockResolvedValueOnce(2); // failedThisWeek
    prisma.automationMessage.findFirst.mockResolvedValue({
      sentAt: new Date("2026-06-15T12:00:00Z"),
    });

    const res = await getWhatsAppActivityStats(TENANT);

    expect(res).toEqual({
      sentThisWeek: 7,
      deliveredThisWeek: 5,
      failedThisWeek: 2,
      lastActivityAt: new Date("2026-06-15T12:00:00Z"),
    });

    // every count carries businessId
    for (const call of prisma.automationMessage.count.mock.calls) {
      const arg = call[0] as { where: { businessId: string } };
      expect(arg.where.businessId).toBe(BUSINESS_A);
    }
    const findArg = prisma.automationMessage.findFirst.mock.calls[0][0] as {
      where: { businessId: string; sentAt: { not: null } };
      orderBy: { sentAt: string };
    };
    expect(findArg.where.businessId).toBe(BUSINESS_A);
    expect(findArg.orderBy).toEqual({ sentAt: "desc" });
  });

  it("returns null lastActivityAt when there is no sent message yet", async () => {
    prisma.automationMessage.count.mockResolvedValue(0);
    prisma.automationMessage.findFirst.mockResolvedValue(null);
    const res = await getWhatsAppActivityStats(TENANT);
    expect(res.lastActivityAt).toBeNull();
    expect(res.sentThisWeek).toBe(0);
  });
});
