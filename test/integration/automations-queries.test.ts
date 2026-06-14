import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import { getLastAutomationRun } from "@/server/automations/run-queries";
import { getAutomationMessageLog } from "@/server/automations/message-queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getLastAutomationRun", () => {
  it("scopes the run lookup to the tenant + type and returns null when none", async () => {
    prisma.automationRun.findFirst.mockResolvedValue(null);
    const result = await getLastAutomationRun(TENANT, "win_back");
    expect(result).toBeNull();
    expect(prisma.automationRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, type: "win_back" },
        orderBy: { startedAt: "desc" },
      }),
    );
  });

  it("aggregates skipped/failed reasons into owner-friendly Hebrew labels, sorted desc", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({
      id: "run_1",
      startedAt: new Date("2026-06-10T08:00:00Z"),
      sentCount: 3,
      failedCount: 1,
      skippedCount: 2,
    });
    prisma.automationMessage.findMany.mockResolvedValue([
      { failureReason: "מספר טלפון לא תקין" },
      { failureReason: "מספר טלפון לא תקין" },
      { failureReason: "נשלחה הודעה לאחרונה" },
    ]);

    const result = await getLastAutomationRun(TENANT, "win_back");
    expect(result).not.toBeNull();
    expect(result!.sentCount).toBe(3);
    // notSent messages queried for this run only
    expect(prisma.automationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ runId: "run_1", status: { in: ["skipped", "failed"] } }),
      }),
    );
    expect(result!.skippedReasons[0]).toEqual({ reason: "אין מספר טלפון", count: 2 });
    expect(result!.skippedReasons[1]).toEqual({ reason: "נשלחה הודעה לאחרונה", count: 1 });
  });
});

describe("getAutomationMessageLog", () => {
  it("scopes to the tenant and maps client info + retry fields", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      {
        id: "m1",
        type: "win_back",
        status: "failed",
        bookingId: "bkg_1",
        failureReason: "x",
        sentAt: null,
        failedAt: new Date("2026-06-10T09:00:00Z"),
        createdAt: new Date("2026-06-10T08:00:00Z"),
        retryCount: 2,
        lastRetryAt: new Date("2026-06-10T08:30:00Z"),
        client: { id: "cli_1", fullName: "דנה" },
      },
    ]);

    const result = await getAutomationMessageLog(TENANT, { limit: 10 });
    expect(prisma.automationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A }, take: 10 }),
    );
    expect(result[0]).toMatchObject({
      id: "m1",
      clientName: "דנה",
      clientId: "cli_1",
      retryCount: 2,
    });
  });

  it("never queries another business's messages", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([]);
    await getAutomationMessageLog({ businessId: BUSINESS_B });
    expect(prisma.automationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_B } }),
    );
  });
});
