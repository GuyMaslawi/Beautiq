import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeService } from "../helpers/factories";
import { parseIsraelDateTime } from "@/lib/time";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import { getAvailableSlots } from "@/server/availability/get-available-slots";

// A far-future date so no slot is filtered out as "in the past".
// (2099-07-01 is a Wednesday -> getDay() === 3, but the source queries rules by
// that weekday; the mock returns rules regardless, so the weekday value only
// matters for the rule query argument, which we assert below.)
const DATE = "2099-07-01";

beforeEach(() => resetPrismaMock(prisma));

function setService(overrides: Record<string, unknown> = {}) {
  prisma.service.findFirst.mockResolvedValue(
    makeService({
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      ...overrides,
    }),
  );
}

describe("getAvailableSlots", () => {
  it("returns no slots and short-circuits when the service is not found (cross-tenant/inactive)", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_x",
    });
    expect(slots).toEqual([]);
    // Should not even query availability when the service lookup fails.
    expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it("looks up the service scoped to the business and isActive", async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await getAvailableSlots({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "svc_1", businessId: BUSINESS_A, isActive: true },
      }),
    );
  });

  it("returns no slots on a closed weekday (no availability rules)", async () => {
    setService();
    prisma.availabilityRule.findMany.mockResolvedValue([]); // closed day
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual([]);
    // The rule query is scoped by business + weekday + isActive.
    const weekday = new Date(2099, 6, 1).getDay();
    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, weekday, isActive: true },
      }),
    );
  });

  it("generates 30-minute slots across the open window for a 60-minute service", async () => {
    setService({ durationMinutes: 60 });
    // 09:00 (540) - 11:00 (660): last slot that fits a 60-min service starts 10:00.
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("respects custom open hours via the rules (e.g. afternoon-only window)", async () => {
    setService({ durationMinutes: 60 });
    // 14:00 (840) - 16:00 (960)
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 840, endMinutes: 960 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual(["14:00", "14:30", "15:00"]);
  });

  it("excludes slots that overlap existing pending/approved bookings", async () => {
    setService({ durationMinutes: 60 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 720 }, // 09:00 - 12:00
    ]);
    // Existing booking 10:00-11:00 (Israel wall-clock) blocks 09:30, 10:00, 10:30.
    prisma.booking.findMany.mockResolvedValue([
      {
        startTime: parseIsraelDateTime(DATE, "10:00"),
        endTime: parseIsraelDateTime(DATE, "11:00"),
      },
    ]);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual(["09:00", "11:00"]);
  });

  it("only considers pending/approved bookings when checking conflicts", async () => {
    setService({ durationMinutes: 60 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    await getAvailableSlots({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: BUSINESS_A,
          status: { in: ["pending", "approved"] },
        }),
      }),
    );
  });

  it("produces no slot when the service (incl. buffers) exceeds the open window", async () => {
    // 120-min total need (90 + 15 + 15) but only a 60-min window.
    setService({
      durationMinutes: 90,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
    });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 600 }, // 09:00 - 10:00, only 60 min
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual([]);
  });

  it("accounts for buffers when fitting slots into the window", async () => {
    // 60 service + 30 buffers = 90 total. Window 09:00-11:00 (120 min).
    // Slots that fit (start + 90 <= 660): 09:00 (ends 10:30), 09:30 (ends 11:00).
    setService({
      durationMinutes: 60,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 15,
    });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });
    expect(slots).toEqual(["09:00", "09:30"]);
  });
});
