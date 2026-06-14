import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Finance read queries. Asserts that all aggregations are scoped by businessId,
 * that profit = revenue - expenses, and that completed-booking revenue + top
 * services are computed correctly.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  getFinanceData,
  getFinanceDashboardSummary,
} from "@/server/finance/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

function dec(n: number) {
  return new Prisma.Decimal(n);
}

describe("getFinanceData", () => {
  it("computes profit = revenue - expenses and scopes every query by businessId", async () => {
    prisma.booking.aggregate
      // completedAgg
      .mockResolvedValueOnce({ _sum: { priceSnapshot: dec(1000) }, _count: 4 })
      // upcomingAgg
      .mockResolvedValueOnce({ _sum: { priceSnapshot: dec(300) }, _count: 2 });
    prisma.booking.findMany.mockResolvedValue([
      { priceSnapshot: dec(400), service: { id: "svc_1", name: "מניקור" } },
      { priceSnapshot: dec(600), service: { id: "svc_1", name: "מניקור" } },
    ]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: dec(250) } });
    prisma.expense.findMany.mockResolvedValue([
      {
        id: "exp_1",
        description: "שכירות",
        category: "rent",
        date: new Date("2026-06-05T12:00:00Z"),
        amount: dec(250),
        notes: null,
      },
    ]);

    const data = await getFinanceData(tenant, "month");

    expect(data.summary.revenue).toBe(1000);
    expect(data.summary.expenses).toBe(250);
    expect(data.summary.profit).toBe(750);
    expect(data.summary.completedBookings).toBe(4);
    expect(data.summary.avgBookingValue).toBe(250);
    expect(data.summary.expensePct).toBe(25);
    expect(data.summary.upcomingRevenue).toBe(300);
    expect(data.summary.upcomingBookingsCount).toBe(2);

    // Top services aggregated by service id.
    expect(data.topServices).toHaveLength(1);
    expect(data.topServices[0]).toMatchObject({
      serviceId: "svc_1",
      bookingsCount: 2,
      revenue: 1000,
      avgPrice: 500,
    });

    expect(data.expenses[0]).toMatchObject({
      id: "exp_1",
      category: "rent",
      amount: 250,
    });

    // Scoping: every aggregate/findMany filtered by the tenant businessId.
    for (const call of prisma.booking.aggregate.mock.calls) {
      expect((call[0] as { where: { businessId: string } }).where.businessId).toBe(
        BUSINESS_A,
      );
    }
    expect(
      (prisma.booking.findMany.mock.calls[0][0] as { where: { businessId: string } })
        .where.businessId,
    ).toBe(BUSINESS_A);
    for (const call of prisma.expense.aggregate.mock.calls) {
      expect((call[0] as { where: { businessId: string } }).where.businessId).toBe(
        BUSINESS_A,
      );
    }
    expect(
      (prisma.expense.findMany.mock.calls[0][0] as { where: { businessId: string } })
        .where.businessId,
    ).toBe(BUSINESS_A);
  });

  it("only counts COMPLETED bookings as revenue", async () => {
    prisma.booking.aggregate
      .mockResolvedValueOnce({ _sum: { priceSnapshot: dec(0) }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { priceSnapshot: null }, _count: 0 });
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.expense.findMany.mockResolvedValue([]);

    await getFinanceData(tenant, "month");

    const completedCall = prisma.booking.aggregate.mock.calls[0][0] as {
      where: { status: string };
    };
    expect(completedCall.where.status).toBe("completed");
  });

  it("handles empty data (null sums) without dividing by zero", async () => {
    prisma.booking.aggregate
      .mockResolvedValueOnce({ _sum: { priceSnapshot: null }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { priceSnapshot: null }, _count: 0 });
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.expense.findMany.mockResolvedValue([]);

    const data = await getFinanceData(tenant, "month");
    expect(data.summary.revenue).toBe(0);
    expect(data.summary.expenses).toBe(0);
    expect(data.summary.profit).toBe(0);
    expect(data.summary.expensePct).toBe(0);
    expect(data.summary.avgBookingValue).toBe(0);
    expect(data.topServices).toEqual([]);
  });

  it("uses a custom date range when both from/to are provided", async () => {
    prisma.booking.aggregate
      .mockResolvedValueOnce({ _sum: { priceSnapshot: dec(0) }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { priceSnapshot: dec(0) }, _count: 0 });
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: dec(0) } });
    prisma.expense.findMany.mockResolvedValue([]);

    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-31T23:59:59Z");
    await getFinanceData(tenant, "month", from, to);

    const completedCall = prisma.booking.aggregate.mock.calls[0][0] as {
      where: { startTime: { gte: Date; lte: Date } };
    };
    expect(completedCall.where.startTime.gte).toEqual(from);
    expect(completedCall.where.startTime.lte).toEqual(to);
  });
});

describe("getFinanceDashboardSummary", () => {
  it("returns month revenue, expenses and profit scoped by businessId", async () => {
    prisma.booking.aggregate.mockResolvedValue({
      _sum: { priceSnapshot: dec(800) },
    });
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: dec(300) } });

    const res = await getFinanceDashboardSummary(tenant);
    expect(res).toEqual({ revenue: 800, expenses: 300, profit: 500 });

    expect(
      (prisma.booking.aggregate.mock.calls[0][0] as { where: { businessId: string; status: string } })
        .where.businessId,
    ).toBe(BUSINESS_A);
    expect(
      (prisma.booking.aggregate.mock.calls[0][0] as { where: { status: string } })
        .where.status,
    ).toBe("completed");
    expect(
      (prisma.expense.aggregate.mock.calls[0][0] as { where: { businessId: string } })
        .where.businessId,
    ).toBe(BUSINESS_A);
  });
});
