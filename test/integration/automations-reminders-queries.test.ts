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
  getRemindersDueCount,
  getRecentAutomationRuns,
} from "@/server/automations/queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getRemindersDueCount", () => {
  it("returns 0 when the morning_reminder automation is disabled / missing", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    const res = await getRemindersDueCount(TENANT);
    expect(res).toBe(0);
    expect(prisma.booking.count).not.toHaveBeenCalled();
    expect(prisma.automationSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_type: { businessId: BUSINESS_A, type: "morning_reminder" },
        },
      }),
    );
  });

  it("counts upcoming un-reminded bookings scoped by tenant when enabled", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({ enabled: true });
    prisma.booking.count.mockResolvedValue(5);
    const res = await getRemindersDueCount(TENANT);
    expect(res).toBe(5);
    const arg = prisma.booking.count.mock.calls[0][0] as {
      where: { businessId: string; reminderSentAt: null; status: { in: string[] } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.reminderSentAt).toBeNull();
    expect(arg.where.status.in).toEqual(["pending", "approved"]);
  });
});

describe("getRecentAutomationRuns", () => {
  it("scopes runs to the tenant, applies default limit, and maps to ISO", async () => {
    prisma.automationRun.findMany.mockResolvedValue([
      {
        id: "run_1",
        type: "morning_reminder",
        status: "success",
        sentCount: 3,
        startedAt: new Date("2026-06-10T08:00:00Z"),
      },
    ]);
    const res = await getRecentAutomationRuns(TENANT);
    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        orderBy: { startedAt: "desc" },
        take: 3,
      }),
    );
    expect(res[0]).toEqual({
      id: "run_1",
      type: "morning_reminder",
      status: "success",
      sentCount: 3,
      startedAtISO: "2026-06-10T08:00:00.000Z",
    });
  });

  it("honors a custom limit", async () => {
    prisma.automationRun.findMany.mockResolvedValue([]);
    await getRecentAutomationRuns(TENANT, 10);
    const arg = prisma.automationRun.findMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(10);
  });
});
