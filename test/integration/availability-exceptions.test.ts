import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

// Deep-mocked prisma so getDayAvailability can be exercised without a database.
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { getDayAvailability } from "@/server/availability/get-available-slots";

const BUSINESS = "biz_a";
// Far-future date so no slot is filtered out as "in the past".
const DATE = "2099-01-05";

beforeEach(() => {
  resetPrismaMock(prisma);
  // 60-minute service, no buffers.
  prisma.service.findFirst.mockResolvedValue({
    durationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
  });
  // No existing bookings → nothing blocks the slots.
  prisma.booking.findMany.mockResolvedValue([]);
});

describe("getDayAvailability — date-specific exceptions", () => {
  it("returns closed (no slots) when the date is marked closed, ignoring weekly rules", async () => {
    prisma.availabilityException.findUnique.mockResolvedValue({
      type: "closed",
      startMinutes: null,
      endMinutes: null,
    });

    const result = await getDayAvailability({
      businessId: BUSINESS,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result).toEqual({ open: false, slots: [] });
    // The weekly rules must not even be consulted on a closed day.
    expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it("uses the custom-hours window instead of the weekly rules", async () => {
    // 10:00–12:00 override (600–720 minutes).
    prisma.availabilityException.findUnique.mockResolvedValue({
      type: "custom_hours",
      startMinutes: 600,
      endMinutes: 720,
    });

    const result = await getDayAvailability({
      businessId: BUSINESS,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result.open).toBe(true);
    // 60-min service stepping by 30: 10:00, 10:30, 11:00 (11:00+60=12:00 fits).
    expect(result.slots).toEqual(["10:00", "10:30", "11:00"]);
    expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it("treats custom_hours with missing window as closed", async () => {
    prisma.availabilityException.findUnique.mockResolvedValue({
      type: "custom_hours",
      startMinutes: null,
      endMinutes: null,
    });

    const result = await getDayAvailability({
      businessId: BUSINESS,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result).toEqual({ open: false, slots: [] });
  });

  it("falls back to the weekly rules when there is no exception", async () => {
    prisma.availabilityException.findUnique.mockResolvedValue(null);
    // 09:00–10:00 weekly window (540–600).
    prisma.availabilityRule.findMany.mockResolvedValue([
      { startMinutes: 540, endMinutes: 600 },
    ]);

    const result = await getDayAvailability({
      businessId: BUSINESS,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(result.open).toBe(true);
    expect(result.slots).toEqual(["09:00"]);
    expect(prisma.availabilityRule.findMany).toHaveBeenCalled();
  });

  it("looks up the exception scoped by businessId + date (tenant-safe)", async () => {
    prisma.availabilityException.findUnique.mockResolvedValue(null);
    prisma.availabilityRule.findMany.mockResolvedValue([]);

    await getDayAvailability({
      businessId: BUSINESS,
      date: DATE,
      serviceId: "svc_1",
    });

    expect(prisma.availabilityException.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId_date: { businessId: BUSINESS, date: new Date(DATE) } },
      }),
    );
  });
});
