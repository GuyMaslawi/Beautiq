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

import {
  getPricingServices,
  buildPricingSummary,
  getPricingConcernCount,
} from "@/server/pricing/queries";

const TENANT = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

function serviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "svc_1",
    name: "מניקור",
    price: new Prisma.Decimal(150),
    durationMinutes: 60,
    isActive: true,
    marketMinPrice: null,
    marketAveragePrice: null,
    marketMaxPrice: null,
    _count: { bookings: 3 },
    ...overrides,
  };
}

describe("getPricingServices", () => {
  it("scopes the findMany by tenant and the nested booking count by tenant+completed", async () => {
    prisma.service.findMany.mockResolvedValue([serviceRow()]);
    const res = await getPricingServices(TENANT);

    const arg = prisma.service.findMany.mock.calls[0][0] as {
      where: { businessId: string };
      orderBy: unknown;
      select: { _count: { select: { bookings: { where: Record<string, unknown> } } } };
    };
    expect(arg.where).toEqual({ businessId: BUSINESS_A });
    expect(arg.orderBy).toEqual([{ isActive: "desc" }, { name: "asc" }]);
    expect(arg.select._count.select.bookings.where).toEqual({
      businessId: BUSINESS_A,
      status: "completed",
    });

    expect(res[0]).toMatchObject({
      id: "svc_1",
      name: "מניקור",
      price: 150,
      durationMinutes: 60,
      pricePerHour: 150, // 150/60*60
      isActive: true,
      completedBookingCount: 3,
      marketMinPrice: null,
      marketAveragePrice: null,
      marketMaxPrice: null,
    });
  });

  it("converts present market prices from Decimal to number", async () => {
    prisma.service.findMany.mockResolvedValue([
      serviceRow({
        marketMinPrice: new Prisma.Decimal(120),
        marketAveragePrice: new Prisma.Decimal(160),
        marketMaxPrice: new Prisma.Decimal(220),
      }),
    ]);
    const res = await getPricingServices(TENANT);
    expect(res[0].marketMinPrice).toBe(120);
    expect(res[0].marketAveragePrice).toBe(160);
    expect(res[0].marketMaxPrice).toBe(220);
  });
});

describe("buildPricingSummary", () => {
  const base = {
    id: "x",
    name: "x",
    price: 150,
    durationMinutes: 60,
    pricePerHour: 150,
    completedBookingCount: 0,
    marketAveragePrice: null,
  };

  it("returns zeros for an empty list", () => {
    const res = buildPricingSummary([]);
    expect(res).toEqual({
      activeServicesCount: 0,
      avgPricePerHour: 0,
      servicesWithRangeCount: 0,
    });
  });

  it("counts active services, averages their per-hour, and counts services with a range", () => {
    const summary = buildPricingSummary([
      { ...base, id: "a", isActive: true, pricePerHour: 100, marketMinPrice: 90, marketMaxPrice: null },
      { ...base, id: "b", isActive: true, pricePerHour: 200, marketMinPrice: null, marketMaxPrice: 300 },
      { ...base, id: "c", isActive: false, pricePerHour: 999, marketMinPrice: null, marketMaxPrice: null },
    ]);
    expect(summary.activeServicesCount).toBe(2);
    // avg per-hour is recomputed from active services' price/duration (both 150/60 => 150)
    expect(summary.avgPricePerHour).toBe(150);
    expect(summary.servicesWithRangeCount).toBe(2);
  });
});

describe("getPricingConcernCount", () => {
  it("scopes the query to active tenant services with a market min set", async () => {
    prisma.service.findMany.mockResolvedValue([]);
    await getPricingConcernCount(TENANT);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: BUSINESS_A,
          isActive: true,
          marketMinPrice: { not: null },
        },
      }),
    );
  });

  it("counts only services priced below their market min", async () => {
    prisma.service.findMany.mockResolvedValue([
      { price: new Prisma.Decimal(80), marketMinPrice: new Prisma.Decimal(100) }, // below -> counts
      { price: new Prisma.Decimal(150), marketMinPrice: new Prisma.Decimal(100) }, // above -> no
      { price: new Prisma.Decimal(100), marketMinPrice: new Prisma.Decimal(100) }, // equal -> no
    ]);
    const res = await getPricingConcernCount(TENANT);
    expect(res).toBe(1);
  });
});
