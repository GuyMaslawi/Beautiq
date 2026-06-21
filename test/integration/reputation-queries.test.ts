import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";
import { Prisma } from "@prisma/client";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getReputationBookings,
  getReputationSummary,
  getClientLatestCompletedBooking,
} from "@/server/reputation/queries";

const tenant = { businessId: BUSINESS_A };

function completedBookingRow(startTime: Date) {
  return {
    id: "bkg_1",
    startTime,
    priceSnapshot: new Prisma.Decimal(180),
    client: { id: "cli_1", fullName: "דנה", phone: "050-123-4567" },
    service: { name: "מניקור" },
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getReputationBookings", () => {
  it("queries completed bookings scoped by business since the recent window, newest first", async () => {
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow(new Date("2026-06-10T09:00:00Z")),
    ]);
    const res = await getReputationBookings(tenant);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      id: "bkg_1",
      clientId: "cli_1",
      clientName: "דנה",
      clientPhone: "050-123-4567",
      serviceName: "מניקור",
      price: 180,
    });

    const arg = prisma.booking.findMany.mock.calls[0][0] as {
      where: { businessId: string; status: string; startTime: { gte: Date } };
      orderBy: { startTime: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.status).toBe("completed");
    expect(arg.where.startTime.gte).toBeInstanceOf(Date);
    expect(arg.orderBy.startTime).toBe("desc");
  });

  it("flags isToday=true for a booking that started today", async () => {
    const today = new Date();
    prisma.booking.findMany.mockResolvedValue([completedBookingRow(today)]);
    const res = await getReputationBookings(tenant);
    expect(res[0].isToday).toBe(true);
  });

  it("flags isToday=false for an older booking", async () => {
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow(new Date("2020-01-01T09:00:00Z")),
    ]);
    const res = await getReputationBookings(tenant);
    expect(res[0].isToday).toBe(false);
  });
});

describe("getReputationSummary", () => {
  it("counts recent completed bookings scoped by business", async () => {
    prisma.booking.count.mockResolvedValue(5);
    const res = await getReputationSummary(tenant);
    expect(res).toEqual({ recentCompletedCount: 5 });
    const arg = prisma.booking.count.mock.calls[0][0] as {
      where: { businessId: string; status: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.status).toBe("completed");
  });
});

describe("getClientLatestCompletedBooking", () => {
  it("returns the latest completed booking for the client scoped by business", async () => {
    prisma.booking.findFirst.mockResolvedValue(
      completedBookingRow(new Date("2026-06-10T09:00:00Z")),
    );
    const res = await getClientLatestCompletedBooking(tenant, "cli_1");
    expect(res).toMatchObject({ id: "bkg_1", clientName: "דנה", price: 180 });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: BUSINESS_A,
          clientId: "cli_1",
          status: "completed",
        }),
        orderBy: { startTime: "desc" },
      }),
    );
  });

  it("returns null when the client has no recent completed booking", async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    expect(await getClientLatestCompletedBooking(tenant, "cli_x")).toBeNull();
  });
});
