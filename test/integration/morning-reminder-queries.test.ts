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
  getMorningReminderSetting,
  getMorningReminderStatsThisMonth,
  getLastMorningReminderRun,
} from "@/server/morning-reminder/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getMorningReminderSetting", () => {
  it("looks up the setting scoped by the tenant business + type", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({ id: "as_1" });
    const res = await getMorningReminderSetting(tenant);
    expect(res).toEqual({ id: "as_1" });
    expect(prisma.automationSetting.findUnique).toHaveBeenCalledWith({
      where: {
        businessId_type: { businessId: BUSINESS_A, type: "morning_reminder" },
      },
    });
  });
});

describe("getMorningReminderStatsThisMonth", () => {
  it("counts bookings with a reminder sent this month scoped by business", async () => {
    prisma.booking.count.mockResolvedValue(4);
    const res = await getMorningReminderStatsThisMonth(tenant);
    expect(res).toEqual({ sentThisMonth: 4 });

    const arg = prisma.booking.count.mock.calls[0][0] as {
      where: { businessId: string; reminderSentAt: { gte: Date } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.reminderSentAt.gte).toBeInstanceOf(Date);
    // monthStart is the first day of the current month
    const now = new Date();
    expect(arg.where.reminderSentAt.gte.getMonth()).toBe(now.getMonth());
    expect(arg.where.reminderSentAt.gte.getDate()).toBe(1);
  });
});

describe("getLastMorningReminderRun", () => {
  it("returns the most recent run scoped + ordered by startedAt desc", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({ id: "run_1" });
    const res = await getLastMorningReminderRun(tenant);
    expect(res).toEqual({ id: "run_1" });
    expect(prisma.automationRun.findFirst).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, type: "morning_reminder" },
      orderBy: { startedAt: "desc" },
    });
  });
});
