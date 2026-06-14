import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createPrismaMock,
  resetPrismaMock,
} from "../helpers/prisma-mock";
import { makeClient, BUSINESS_A } from "../helpers/factories";

// --- Mocked Prisma (shared singleton) -------------------------------------
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
  getEligibleClients,
  getEligibilityBreakdown,
} from "@/server/win-back-automation/eligibility";

const TENANT = { businessId: BUSINESS_A };
const OPTIONS = {
  thresholdDays: 45,
  cooldownDays: 30,
  requireOptIn: true,
};

/** Helper: an eligible client row as returned by prisma.client.findMany. */
function eligibleRow(
  overrides: Record<string, unknown> = {},
  bookings?: unknown[],
) {
  const client = makeClient(overrides);
  return {
    ...client,
    bookings: bookings ?? [
      {
        id: "bkg_old",
        status: "completed",
        startTime: new Date("2026-01-01T09:00:00Z"),
        priceSnapshot: new Prisma.Decimal(200),
        service: { name: "מניקור" },
      },
    ],
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getEligibleClients — query shape & tenant scoping", () => {
  it("scopes findMany to the tenant businessId with all base filters", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, OPTIONS);

    expect(prisma.client.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.client.findMany.mock.calls[0][0];
    const where = arg.where;

    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.unsubscribedAt).toBeNull();
    expect(where.normalizedPhone).toEqual({ startsWith: "+972" });
    expect(where.marketingOptIn).toBe(true);

    // completed-older-than-threshold + no-future-booking booking filters
    expect(where.bookings.some).toMatchObject({
      businessId: BUSINESS_A,
      status: "completed",
    });
    expect(where.bookings.some.startTime).toHaveProperty("lt");
    expect(where.bookings.none).toMatchObject({
      businessId: BUSINESS_A,
      status: { in: ["pending", "approved"] },
    });
    expect(where.bookings.none.startTime).toHaveProperty("gt");

    // included bookings are scoped to the same business
    expect(arg.include.bookings.where).toEqual({ businessId: BUSINESS_A });
  });

  it("adds whatsappOptIn:true when requireOptIn is enabled", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, { ...OPTIONS, requireOptIn: true });
    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.whatsappOptIn).toBe(true);
  });

  it("omits whatsappOptIn when requireOptIn is disabled", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, { ...OPTIONS, requireOptIn: false });
    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.whatsappOptIn).toBeUndefined();
  });

  it("applies the cooldown filter (automationMessages none within cooldownDays) by default", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, OPTIONS);
    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.automationMessages.none).toMatchObject({
      businessId: BUSINESS_A,
      type: "win_back",
      status: { in: ["queued", "sent", "delivered", "read"] },
    });
    expect(where.automationMessages.none.createdAt).toHaveProperty("gt");
  });

  it("removes the cooldown filter when ignoreCooldown=true (admin manual only)", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await getEligibleClients(TENANT, { ...OPTIONS, ignoreCooldown: true });
    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.automationMessages).toBeUndefined();
  });
});

describe("getEligibleClients — mapping & post-filtering", () => {
  it("computes totalRevenue from completed bookings and last visit data", async () => {
    prisma.client.findMany.mockResolvedValue([
      eligibleRow({ id: "cli_1", fullName: "דנה" }, [
        {
          id: "bkg_2",
          status: "completed",
          startTime: new Date("2026-03-01T09:00:00Z"),
          priceSnapshot: new Prisma.Decimal(100),
          service: { name: "לק ג'ל" },
        },
        {
          id: "bkg_1",
          status: "completed",
          startTime: new Date("2026-01-01T09:00:00Z"),
          priceSnapshot: new Prisma.Decimal(250),
          service: { name: "מניקור" },
        },
      ]),
    ]);

    const result = await getEligibleClients(TENANT, OPTIONS);
    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.id).toBe("cli_1");
    expect(c.totalRevenue).toBe(350);
    expect(c.totalCompletedBookings).toBe(2);
    // bookings are ordered desc by query, so the first completed is the latest
    expect(c.lastServiceName).toBe("לק ג'ל");
    expect(c.lastBookingId).toBe("bkg_2");
    expect(c.daysSinceLastVisit).toBeGreaterThan(0);
  });

  it("filters out clients whose normalizedPhone fails the secondary E.164 regex", async () => {
    prisma.client.findMany.mockResolvedValue([
      // +972 prefix passed the DB filter but has too few digits → rejected by regex
      eligibleRow({ id: "cli_bad", normalizedPhone: "+97250" }),
      eligibleRow({ id: "cli_ok", normalizedPhone: "+972501234567" }),
    ]);
    const result = await getEligibleClients(TENANT, OPTIONS);
    expect(result.map((c) => c.id)).toEqual(["cli_ok"]);
  });

  it("drops clients with no completed booking in the returned set", async () => {
    prisma.client.findMany.mockResolvedValue([
      eligibleRow({ id: "cli_nocompleted" }, [
        {
          id: "bkg_x",
          status: "cancelled",
          startTime: new Date("2026-01-01T09:00:00Z"),
          priceSnapshot: new Prisma.Decimal(50),
          service: { name: "x" },
        },
      ]),
    ]);
    const result = await getEligibleClients(TENANT, OPTIONS);
    expect(result).toHaveLength(0);
  });

  it("sorts results by daysSinceLastVisit descending (oldest first)", async () => {
    prisma.client.findMany.mockResolvedValue([
      eligibleRow({ id: "recent" }, [
        {
          id: "b1",
          status: "completed",
          startTime: new Date("2026-05-01T09:00:00Z"),
          priceSnapshot: new Prisma.Decimal(100),
          service: { name: "a" },
        },
      ]),
      eligibleRow({ id: "old" }, [
        {
          id: "b2",
          status: "completed",
          startTime: new Date("2025-01-01T09:00:00Z"),
          priceSnapshot: new Prisma.Decimal(100),
          service: { name: "b" },
        },
      ]),
    ]);
    const result = await getEligibleClients(TENANT, OPTIONS);
    expect(result.map((c) => c.id)).toEqual(["old", "recent"]);
  });

  it("never includes a client from another business (cross-tenant)", async () => {
    // The query is scoped by businessId; assert the scoping is present and that
    // a B-row would not satisfy it. We simulate the DB honouring the filter by
    // returning only the A row.
    prisma.client.findMany.mockResolvedValue([
      eligibleRow({ id: "cli_A", businessId: BUSINESS_A }),
    ]);
    const result = await getEligibleClients(TENANT, OPTIONS);
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(
      BUSINESS_A,
    );
    expect(result.every((c) => c.id !== "cli_B")).toBe(true);
  });
});

describe("getEligibilityBreakdown", () => {
  function primeCounts() {
    // Promise.all order: total, eligible(via findMany), noOptIn, noMarketingOptIn, invalidPhone
    // eligible uses getEligibleClients -> client.findMany
    prisma.client.count.mockResolvedValue(0);
    prisma.client.findMany.mockResolvedValue([]);
  }

  it("scopes every count query to the tenant businessId", async () => {
    primeCounts();
    await getEligibilityBreakdown(TENANT, OPTIONS);
    for (const call of prisma.client.count.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_A);
    }
    // findMany (eligible path) is also tenant-scoped
    expect(prisma.client.findMany.mock.calls[0][0].where.businessId).toBe(
      BUSINESS_A,
    );
  });

  it("counts whatsapp opt-in only when requireOptIn=true", async () => {
    primeCounts();
    await getEligibilityBreakdown(TENANT, { ...OPTIONS, requireOptIn: false });
    // No count query should target whatsappOptIn:false when requireOptIn is off
    const hasOptInCount = prisma.client.count.mock.calls.some(
      (c) => c[0].where.whatsappOptIn === false,
    );
    expect(hasOptInCount).toBe(false);
  });

  it("reports inCooldown count and zero override by default", async () => {
    // Make the raw cooldown count distinct so we can identify it.
    prisma.client.count.mockResolvedValue(0);
    // The cooldown count is the query carrying automationMessages.some
    prisma.client.count.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if (arg.where.automationMessages) return 7;
      return 0;
    });
    prisma.client.findMany.mockResolvedValue([]);

    const breakdown = await getEligibilityBreakdown(TENANT, OPTIONS);
    expect(breakdown.inCooldown).toBe(7);
    expect(breakdown.cooldownOverrideCount).toBe(0);
  });

  it("moves the cooldown count into cooldownOverrideCount when ignoreCooldown=true", async () => {
    prisma.client.count.mockImplementation(async (arg: { where: Record<string, unknown> }) => {
      if (arg.where.automationMessages) return 7;
      return 0;
    });
    prisma.client.findMany.mockResolvedValue([]);

    const breakdown = await getEligibilityBreakdown(TENANT, {
      ...OPTIONS,
      ignoreCooldown: true,
    });
    expect(breakdown.inCooldown).toBe(0);
    expect(breakdown.cooldownOverrideCount).toBe(7);
  });
});
