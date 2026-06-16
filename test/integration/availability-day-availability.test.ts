import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B, makeService } from "../helpers/factories";
import { parseIsraelDateTime, israeliWeekday } from "@/lib/time";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import {
  getDayAvailability,
  getAvailableSlots,
} from "@/server/availability/get-available-slots";

// Far-future date so no slot is filtered out as "in the past".
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

describe("getDayAvailability — owner booking slot lookup", () => {
  it("REGRESSION: an open day with a 30-min service and no bookings returns multiple times (not 'no slots')", async () => {
    setService({ durationMinutes: 30 });
    // 09:00 (540) – 11:00 (660): a 30-min service fits at :00 and :30.
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await getDayAvailability({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result.open).toBe(true);
    expect(result.slots).toEqual(["09:00", "09:30", "10:00", "10:30"]);
    expect(result.slots.length).toBeGreaterThan(1);
  });

  it("reports the business as OPEN with no free times when fully booked (distinct from closed)", async () => {
    setService({ durationMinutes: 60 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 }, // 09:00–11:00
    ]);
    // A single booking covering the whole window.
    prisma.booking.findMany.mockResolvedValue([
      {
        startTime: parseIsraelDateTime(DATE, "09:00"),
        endTime: parseIsraelDateTime(DATE, "11:00"),
      },
    ]);

    const result = await getDayAvailability({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result.open).toBe(true);
    expect(result.slots).toEqual([]);
  });

  it("reports CLOSED (open: false) when there is no availability rule for the weekday", async () => {
    setService();
    prisma.availabilityRule.findMany.mockResolvedValue([]); // closed day

    const result = await getDayAvailability({
      businessId: BUSINESS_A,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result).toEqual({ open: false, slots: [] });
  });

  it("queries availability rules by the Israel weekday for the selected date", async () => {
    setService();
    prisma.availabilityRule.findMany.mockResolvedValue([]);

    await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    expect(prisma.availabilityRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, weekday: israeliWeekday(DATE), isActive: true },
      }),
    );
  });

  it("service duration affects the number of slots produced", async () => {
    // Same window (09:00–11:00); shorter service => more slots.
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    setService({ durationMinutes: 30 });
    const short = await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    resetPrismaMock(prisma);
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    setService({ durationMinutes: 60 });
    const long = await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    expect(short.slots.length).toBeGreaterThan(long.slots.length);
    expect(short.slots).toEqual(["09:00", "09:30", "10:00", "10:30"]);
    expect(long.slots).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("an overlapping booking blocks ONLY the overlapping slots, not the whole day", async () => {
    setService({ durationMinutes: 60 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 720 }, // 09:00–12:00
    ]);
    // 10:00–11:00 blocks 09:30, 10:00, 10:30 — but 09:00 and 11:00 remain.
    prisma.booking.findMany.mockResolvedValue([
      {
        startTime: parseIsraelDateTime(DATE, "10:00"),
        endTime: parseIsraelDateTime(DATE, "11:00"),
      },
    ]);

    const result = await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    expect(result.slots).toEqual(["09:00", "11:00"]);
  });

  it("a cancelled/no-show booking does not block a slot (only pending/approved are considered)", async () => {
    setService({ durationMinutes: 60 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    // The conflict query must filter to pending/approved — cancelled and
    // no_show bookings are never fetched, so they cannot block slots.
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: BUSINESS_A,
          status: { in: ["pending", "approved"] },
        }),
      }),
    );
  });

  it("does not leak cross-tenant availability: the service is scoped by businessId", async () => {
    // Service belongs to Business A only; querying as Business B finds nothing.
    prisma.service.findFirst.mockResolvedValue(null);

    const result = await getDayAvailability({
      businessId: BUSINESS_B,
      date: DATE,
      serviceId: "svc_owned_by_a",
    });

    expect(result).toEqual({ open: false, slots: [] });
    expect(prisma.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "svc_owned_by_a", businessId: BUSINESS_B, isActive: true },
      }),
    );
    // Never query availability rules for a service that isn't in this tenant.
    expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it("getAvailableSlots (public/owner shared helper) returns the same times as getDayAvailability.slots", async () => {
    setService({ durationMinutes: 30 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);

    const detailed = await getDayAvailability({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    resetPrismaMock(prisma);
    setService({ durationMinutes: 30 });
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 660 },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots({ businessId: BUSINESS_A, date: DATE, serviceId: "svc_1" });

    expect(slots).toEqual(detailed.slots);
  });
});
