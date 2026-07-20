import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Dashboard aggregation. The headline assertion: EVERY count/aggregate/findMany
 * is scoped by the tenant businessId (CLAUDE.md §10) — no cross-tenant leakage
 * into the dashboard metrics. Also verifies setup flags and booking mapping.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { getDashboardData } from "@/server/dashboard/queries";

const tenant = { businessId: BUSINESS_A };
const emptyProfile = {
  phone: null,
  description: null,
  city: null,
  area: null,
  addressNote: null,
};

beforeEach(() => resetPrismaMock(prisma));

function setupMocks(overrides: {
  clients?: number;
  activeServices?: number;
  monthRevenue?: number;
  categories?: number;
  availability?: number;
  totalBookings?: number;
  todayBookings?: unknown[];
  upcoming?: unknown[];
} = {}) {
  prisma.client.count.mockResolvedValue(overrides.clients ?? 0);
  prisma.service.count.mockResolvedValue(overrides.activeServices ?? 0);
  prisma.booking.aggregate.mockResolvedValue({
    _sum: { priceSnapshot: new Prisma.Decimal(overrides.monthRevenue ?? 0) },
  });
  prisma.businessCategoryOnBusiness.count.mockResolvedValue(
    overrides.categories ?? 0,
  );
  prisma.availabilityRule.count.mockResolvedValue(overrides.availability ?? 0);
  // booking.count is called once: total bookings (approval step removed).
  prisma.booking.count.mockResolvedValueOnce(overrides.totalBookings ?? 0);
  // booking.findMany is called twice: today, then upcoming.
  prisma.booking.findMany
    .mockResolvedValueOnce(overrides.todayBookings ?? [])
    .mockResolvedValueOnce(overrides.upcoming ?? []);
}

function assertScoped() {
  const checks: Array<[string, { where?: { businessId?: string } } | undefined]> = [
    ["client.count", prisma.client.count.mock.calls[0]?.[0] as never],
    ["service.count", prisma.service.count.mock.calls[0]?.[0] as never],
    ["booking.aggregate", prisma.booking.aggregate.mock.calls[0]?.[0] as never],
    [
      "category.count",
      prisma.businessCategoryOnBusiness.count.mock.calls[0]?.[0] as never,
    ],
    ["availability.count", prisma.availabilityRule.count.mock.calls[0]?.[0] as never],
    ["booking.count[0]", prisma.booking.count.mock.calls[0]?.[0] as never],
    ["booking.findMany[0]", prisma.booking.findMany.mock.calls[0]?.[0] as never],
    ["booking.findMany[1]", prisma.booking.findMany.mock.calls[1]?.[0] as never],
  ];
  for (const [label, call] of checks) {
    expect(call?.where?.businessId, `${label} must be scoped to tenant`).toBe(
      BUSINESS_A,
    );
  }
}

describe("getDashboardData", () => {
  it("scopes every count/aggregate/findMany by the tenant businessId", async () => {
    setupMocks();
    await getDashboardData(tenant, emptyProfile);
    assertScoped();
  });

  it("computes metrics and setup flags correctly", async () => {
    setupMocks({
      clients: 5,
      activeServices: 3,
      monthRevenue: 1200,
      categories: 2,
      availability: 1,
      totalBookings: 10,
      todayBookings: [
        {
          id: "bkg_1",
          startTime: new Date("2026-06-14T09:00:00Z"),
          status: "approved",
          client: { fullName: "דנה" },
          service: { name: "מניקור" },
        },
      ],
      upcoming: [
        {
          id: "bkg_2",
          startTime: new Date("2026-06-20T09:00:00Z"),
          status: "pending",
          client: { fullName: "נועה" },
          service: { name: "פדיקור" },
        },
      ],
    });

    const data = await getDashboardData(tenant, emptyProfile);

    expect(data.metrics).toEqual({
      bookingsToday: 1,
      totalClients: 5,
      activeServices: 3,
      monthRevenue: 1200,
    });
    expect(data.setup).toEqual({
      hasCategories: true,
      hasActiveService: true,
      hasAvailabilityRule: true,
      hasProfileDetails: false,
      hasAnyBookings: true,
    });
    expect(data.todayBookings[0]).toMatchObject({
      id: "bkg_1",
      clientName: "דנה",
      serviceName: "מניקור",
      status: "approved",
    });
    expect(data.upcomingBookings[0].clientName).toBe("נועה");
  });

  it("derives hasProfileDetails from the passed-in business profile", async () => {
    setupMocks();
    const withPhone = await getDashboardData(tenant, {
      ...emptyProfile,
      phone: "0501234567",
    });
    expect(withPhone.setup.hasProfileDetails).toBe(true);
  });

  it("only counts COMPLETED bookings toward month revenue", async () => {
    setupMocks({ monthRevenue: 500 });
    await getDashboardData(tenant, emptyProfile);
    const aggCall = prisma.booking.aggregate.mock.calls[0][0] as {
      where: { status: string };
    };
    expect(aggCall.where.status).toBe("completed");
  });
});
