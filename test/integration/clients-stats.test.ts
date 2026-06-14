import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
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

import { syncClientStats } from "@/server/clients/stats";

beforeEach(() => resetPrismaMock(prisma));

function bk(overrides: Record<string, unknown>) {
  return {
    status: "completed",
    startTime: new Date("2026-05-01T09:00:00Z"),
    priceSnapshot: new Prisma.Decimal(0),
    ...overrides,
  };
}

describe("syncClientStats — tenant scoping & recompute", () => {
  it("reads bookings scoped by businessId AND clientId", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.client.updateMany.mockResolvedValue({ count: 1 });

    await syncClientStats({ businessId: BUSINESS_A, clientId: "cli_1" });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, clientId: "cli_1" },
      }),
    );
  });

  it("writes denormalized stats with a scoped updateMany (id + businessId)", async () => {
    prisma.booking.findMany.mockResolvedValue([
      bk({ status: "completed", priceSnapshot: new Prisma.Decimal(150), startTime: new Date("2026-05-10") }),
      bk({ status: "completed", priceSnapshot: new Prisma.Decimal(200), startTime: new Date("2026-05-20") }),
      bk({ status: "no_show" }),
      bk({ status: "cancelled" }),
      bk({ status: "rescheduled" }),
    ]);
    prisma.client.updateMany.mockResolvedValue({ count: 1 });

    await syncClientStats({ businessId: BUSINESS_A, clientId: "cli_1" });

    expect(prisma.client.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.client.updateMany.mock.calls[0][0] as {
      where: { id: string; businessId: string };
      data: {
        totalBookings: number;
        noShowCount: number;
        cancellationCount: number;
        totalSpent: Prisma.Decimal;
        lastVisitAt: Date | null;
      };
    };
    expect(arg.where).toEqual({ id: "cli_1", businessId: BUSINESS_A });
    // rescheduled excluded from totalBookings (5 rows - 1 rescheduled = 4)
    expect(arg.data.totalBookings).toBe(4);
    expect(arg.data.noShowCount).toBe(1);
    expect(arg.data.cancellationCount).toBe(1);
    expect(arg.data.totalSpent.toString()).toBe("350");
    expect(arg.data.lastVisitAt).toEqual(new Date("2026-05-20"));
  });

  it("sets lastVisitAt null and totalSpent 0 when no completed bookings", async () => {
    prisma.booking.findMany.mockResolvedValue([bk({ status: "no_show" })]);
    prisma.client.updateMany.mockResolvedValue({ count: 1 });

    await syncClientStats({ businessId: BUSINESS_A, clientId: "cli_1" });
    const arg = prisma.client.updateMany.mock.calls[0][0] as {
      data: { lastVisitAt: Date | null; totalSpent: Prisma.Decimal };
    };
    expect(arg.data.lastVisitAt).toBeNull();
    expect(arg.data.totalSpent.toString()).toBe("0");
  });
});
