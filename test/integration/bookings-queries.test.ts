import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeBooking } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import { getBooking, hasOverlap, hasBookings } from "@/server/bookings/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

// ---------------------------------------------------------------------------
// getBooking
// ---------------------------------------------------------------------------

describe("getBooking", () => {
  it("scopes the lookup by businessId (cross-tenant id returns null)", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    const res = await getBooking(tenant, "bkg_other_tenant");
    expect(res).toBeNull();
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "bkg_other_tenant",
          businessId: BUSINESS_A,
        }),
      }),
    );
  });

  it("returns the booking when it belongs to the tenant", async () => {
    const booking = makeBooking({ id: "bkg_1" });
    prisma.booking.findFirst.mockResolvedValue(booking);
    const res = await getBooking(tenant, "bkg_1");
    expect(res).toBe(booking);
  });
});

// ---------------------------------------------------------------------------
// hasOverlap
// ---------------------------------------------------------------------------

describe("hasOverlap", () => {
  const start = new Date("2099-07-01T09:00:00Z");
  const end = new Date("2099-07-01T10:00:00Z");

  it("scopes by businessId and only counts pending/approved bookings that overlap", async () => {
    prisma.booking.count.mockResolvedValue(0);
    const res = await hasOverlap(tenant, start, end);
    expect(res).toBe(false);
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        businessId: BUSINESS_A,
        status: { in: ["pending", "approved"] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    });
  });

  it("returns true when at least one overlapping booking exists", async () => {
    prisma.booking.count.mockResolvedValue(1);
    expect(await hasOverlap(tenant, start, end)).toBe(true);
  });

  it("excludes a given booking id when rescheduling", async () => {
    prisma.booking.count.mockResolvedValue(0);
    await hasOverlap(tenant, start, end, "bkg_self");
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        businessId: BUSINESS_A,
        id: { not: "bkg_self" },
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// hasBookings
// ---------------------------------------------------------------------------

describe("hasBookings", () => {
  it("scopes the count by businessId", async () => {
    prisma.booking.count.mockResolvedValue(3);
    expect(await hasBookings(tenant)).toBe(true);
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A },
    });
  });

  it("returns false when there are no bookings", async () => {
    prisma.booking.count.mockResolvedValue(0);
    expect(await hasBookings(tenant)).toBe(false);
  });
});
