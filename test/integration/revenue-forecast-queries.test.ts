import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

/**
 * Revenue forecast read path (server/revenue-forecast/queries.ts). Lower urgency
 * than the customer-facing/booking/WhatsApp paths, but still a multi-tenant read:
 * every aggregate/count MUST be scoped by businessId and the empty-DB case must
 * produce a safe, fully-zeroed forecast.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";

const A = { businessId: BUSINESS_A };

function emptyAgg() {
  return { _sum: { priceSnapshot: null }, _count: 0 };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.booking.aggregate.mockResolvedValue(emptyAgg());
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.booking.count.mockResolvedValue(0);
  prisma.client.count.mockResolvedValue(0);
  prisma.service.aggregate.mockResolvedValue({ _avg: { price: null } });
  prisma.service.count.mockResolvedValue(0);
});

describe("getRevenueForecastData", () => {
  it("returns a safe, zeroed forecast on an empty database", async () => {
    const res = await getRevenueForecastData(A);
    expect(res.completedRevenue).toBe(0);
    expect(res.expectedRevenue).toBe(0);
    expect(res.monthlyTarget).toBe(0);
    expect(res.hasEnoughData).toBe(false);
    expect(res.confidence).toBe("low");
    expect(res.topServices).toEqual([]);
  });

  it("scopes every aggregate/count/findMany by the tenant businessId", async () => {
    await getRevenueForecastData(A);
    for (const call of prisma.booking.aggregate.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_A);
    }
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.client.count.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.service.aggregate.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
    expect(prisma.service.count.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
  });

  it("uses a different scope for a different tenant (no cross-tenant read)", async () => {
    await getRevenueForecastData({ businessId: BUSINESS_B });
    expect(prisma.booking.aggregate.mock.calls[0][0].where.businessId).toBe(BUSINESS_B);
  });

  it("derives a 15%-above-last-month target and aggregates top services", async () => {
    // last month completed revenue = 1000 → target = 1150
    prisma.booking.aggregate
      .mockResolvedValueOnce({ _sum: { priceSnapshot: new Prisma.Decimal(800) }, _count: 4 }) // this month completed
      .mockResolvedValueOnce(emptyAgg()) // upcoming
      .mockResolvedValueOnce(emptyAgg()) // lost
      .mockResolvedValueOnce({ _sum: { priceSnapshot: new Prisma.Decimal(1000) }, _count: 5 }); // last month
    prisma.booking.findMany.mockResolvedValue([
      { priceSnapshot: new Prisma.Decimal(500), service: { id: "s1", name: "טיפול" } },
      { priceSnapshot: new Prisma.Decimal(300), service: { id: "s1", name: "טיפול" } },
    ]);

    const res = await getRevenueForecastData(A);
    expect(res.monthlyTarget).toBe(1150);
    expect(res.completedRevenue).toBe(800);
    expect(res.targetReliable).toBe(true);
    expect(res.topServices).toHaveLength(1);
    expect(res.topServices[0]).toMatchObject({
      id: "s1",
      bookingsCount: 2,
      revenue: 800,
    });
  });
});
