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
  getReminderSettings,
  getRemindersData,
  getRemindersDueCount,
  getRecentAutomationRuns,
  DEFAULT_REMINDER_HOURS,
  DEFAULT_REMINDER_TEMPLATE,
} from "@/server/automations/queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getReminderSettings", () => {
  it("returns defaults when business is missing / settings null", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await getReminderSettings(TENANT);
    expect(res.reminderHoursBefore).toBe(DEFAULT_REMINDER_HOURS);
    expect(res.reminderTemplate).toBe(DEFAULT_REMINDER_TEMPLATE);
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BUSINESS_A } }),
    );
  });

  it("returns defaults when settings is not an object", async () => {
    prisma.business.findUnique.mockResolvedValue({ settings: "nope" });
    const res = await getReminderSettings(TENANT);
    expect(res.reminderHoursBefore).toBe(DEFAULT_REMINDER_HOURS);
    expect(res.reminderTemplate).toBe(DEFAULT_REMINDER_TEMPLATE);
  });

  it("reads custom values from settings JSON", async () => {
    prisma.business.findUnique.mockResolvedValue({
      settings: { reminderHoursBefore: 48, reminderTemplate: "היי {שם}" },
    });
    const res = await getReminderSettings(TENANT);
    expect(res.reminderHoursBefore).toBe(48);
    expect(res.reminderTemplate).toBe("היי {שם}");
  });

  it("falls back to defaults for invalid values inside settings", async () => {
    prisma.business.findUnique.mockResolvedValue({
      settings: { reminderHoursBefore: 0, reminderTemplate: "   " },
    });
    const res = await getReminderSettings(TENANT);
    expect(res.reminderHoursBefore).toBe(DEFAULT_REMINDER_HOURS);
    expect(res.reminderTemplate).toBe(DEFAULT_REMINDER_TEMPLATE);
  });
});

describe("getRemindersData", () => {
  function bookingRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "bkg_1",
      startTime: new Date("2026-07-01T11:00:00Z"),
      client: { fullName: "עדי לוי", phone: "050-1234567" },
      service: { name: "מניקור" },
      reminders: [],
      ...overrides,
    };
  }

  it("scopes the booking query by tenant + status + time window and maps items", async () => {
    prisma.business.findUnique
      .mockResolvedValueOnce({ settings: {}, name: "סטודיו יופי" })
      .mockResolvedValueOnce({ name: "סטודיו יופי" });
    prisma.booking.findMany.mockResolvedValue([
      bookingRow(),
      bookingRow({ id: "bkg_2", reminders: [{ id: "rem_1", status: "sent" }] }),
    ]);

    const res = await getRemindersData(TENANT);

    const arg = prisma.booking.findMany.mock.calls[0][0] as {
      where: { businessId: string; status: { in: string[] } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.status.in).toEqual(["pending", "approved"]);

    expect(res.remindersDue).toHaveLength(2);
    expect(res.remindersDue[0].reminderId).toBeNull();
    expect(res.remindersDue[0].reminderStatus).toBeNull();
    // template substitution produced a non-empty message with the client name
    expect(res.remindersDue[0].message).toContain("עדי לוי");
    expect(res.remindersDue[1].reminderId).toBe("rem_1");
    expect(res.remindersDue[1].reminderStatus).toBe("sent");
    // pending count: bkg_1 (no reminder) counts; bkg_2 (sent) does not
    expect(res.pendingCount).toBe(1);
  });

  it("counts pending/failed/null reminders only", async () => {
    prisma.business.findUnique
      .mockResolvedValueOnce({ settings: {}, name: "X" })
      .mockResolvedValueOnce({ name: "X" });
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ id: "a", reminders: [{ id: "r1", status: "pending" }] }),
      bookingRow({ id: "b", reminders: [{ id: "r2", status: "failed" }] }),
      bookingRow({ id: "c", reminders: [{ id: "r3", status: "sent" }] }),
      bookingRow({ id: "d", reminders: [] }),
    ]);
    const res = await getRemindersData(TENANT);
    expect(res.pendingCount).toBe(3);
  });

  it("uses empty businessName when business not found", async () => {
    prisma.business.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.booking.findMany.mockResolvedValue([]);
    const res = await getRemindersData(TENANT);
    expect(res.remindersDue).toEqual([]);
    expect(res.settings.reminderHoursBefore).toBe(DEFAULT_REMINDER_HOURS);
  });
});

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
