import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { BUSINESS_A, BUSINESS_B, makeBooking } from "../helpers/factories";

/**
 * Bookings READ/LIST path (server/bookings/queries.ts). Bookings are the heart of
 * the CRM. Every list/summary/calendar query MUST be scoped by businessId
 * (CLAUDE.md §10) and handle empty results safely.
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
import {
  getBookings,
  getCalendarBookings,
  getLateCancellationsThisWeek,
  getBookingSummary,
  getActiveCancellationPolicy,
} from "@/server/bookings/queries";

const tenant = { businessId: BUSINESS_A };

function row(overrides: Record<string, unknown> = {}) {
  return {
    ...makeBooking(overrides),
    client: { id: "cli_1", fullName: "אבי", phone: "050-111-1111" },
    service: { id: "svc_1", name: "תספורת", durationMinutes: 60 },
    ...overrides,
  };
}

beforeEach(() => resetPrismaMock(prisma));

describe("getBookings", () => {
  it("scopes the list by businessId and returns [] safely when empty", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const res = await getBookings(tenant);
    expect(res).toEqual([]);
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
  });

  it("never reads another business's bookings (a different tenant scopes differently)", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await getBookings({ businessId: BUSINESS_B });
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_B);
  });

  it("maps the status filter to concrete statuses, still businessId-scoped", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await getBookings(tenant, { statusFilter: "active" });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.status).toEqual({ in: ["pending", "approved"] });
  });

  it("applies a today filter as a startTime range scoped to the business", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await getBookings(tenant, { filter: "today" });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.startTime).toHaveProperty("gte");
    expect(where.startTime).toHaveProperty("lte");
  });

  it("passes a client name/phone search into the scoped where clause", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await getBookings(tenant, { search: "אבי" });
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.client.OR[0].fullName.contains).toBe("אבי");
  });

  it("never scopes the query by any deposit status (deposits are removed)", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    await getBookings(tenant);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("depositStatus");
  });

  it("sorts by client name (Hebrew-aware) at the app level when requested", async () => {
    prisma.booking.findMany.mockResolvedValue([
      row({ id: "b1", client: { id: "c1", fullName: "תמר", phone: "1" } }),
      row({ id: "b2", client: { id: "c2", fullName: "אבי", phone: "2" } }),
    ]);
    const res = await getBookings(tenant, { sortField: "clientName", sortDir: "asc" });
    expect(res.map((b) => b.client.fullName)).toEqual(["אבי", "תמר"]);
  });
});

describe("getCalendarBookings", () => {
  it("scopes by businessId + date range and serializes safely", async () => {
    prisma.booking.findMany.mockResolvedValue([
      row({ priceSnapshot: new Prisma.Decimal(150) }),
    ]);
    const from = new Date("2026-07-01T00:00:00Z");
    const to = new Date("2026-07-31T23:59:59Z");
    const res = await getCalendarBookings(tenant, from, to);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.startTime).toEqual({ gte: from, lte: to });
    expect(res[0].priceSnapshot).toBe(150);
    expect(typeof res[0].startTime).toBe("string");
  });

  it("returns [] safely when there are no bookings in range", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    expect(await getCalendarBookings(tenant, new Date(), new Date())).toEqual([]);
  });
});

describe("getActiveCancellationPolicy", () => {
  it("scopes the lookup by businessId and returns null when disabled", async () => {
    prisma.cancellationPolicy.findUnique.mockResolvedValue({
      enabled: false,
      lateCancellationHours: 24,
      lateCancellationFeeType: "fixed",
      lateCancellationFeeAmount: null,
      lateCancellationFeePercentage: null,
    });
    const res = await getActiveCancellationPolicy(tenant);
    expect(res).toBeNull();
    expect(prisma.cancellationPolicy.findUnique.mock.calls[0][0].where).toEqual({
      businessId: BUSINESS_A,
    });
  });

  it("returns the policy with serialized decimal amounts when enabled", async () => {
    prisma.cancellationPolicy.findUnique.mockResolvedValue({
      enabled: true,
      lateCancellationHours: 24,
      lateCancellationFeeType: "fixed",
      lateCancellationFeeAmount: new Prisma.Decimal(30),
      lateCancellationFeePercentage: null,
    });
    const res = await getActiveCancellationPolicy(tenant);
    expect(res).toMatchObject({ enabled: true, lateCancellationFeeAmount: "30" });
  });
});

describe("getLateCancellationsThisWeek", () => {
  it("returns 0 safely when no policy is enabled (no booking scan)", async () => {
    prisma.cancellationPolicy.findUnique.mockResolvedValue(null);
    expect(await getLateCancellationsThisWeek(tenant)).toBe(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("counts only cancellations inside the late window, scoped by businessId", async () => {
    prisma.cancellationPolicy.findUnique.mockResolvedValue({
      enabled: true,
      lateCancellationHours: 24,
    });
    const start = new Date("2026-06-20T10:00:00Z");
    prisma.booking.findMany.mockResolvedValue([
      // cancelled 1h before start → inside the 24h window → counts
      { cancelledAt: new Date("2026-06-20T09:00:00Z"), noShowAt: null, startTime: start },
      // cancelled 3 days before → outside the window → does not count
      {
        cancelledAt: new Date("2026-06-17T10:00:00Z"),
        noShowAt: null,
        startTime: start,
      },
    ]);
    const res = await getLateCancellationsThisWeek(tenant);
    expect(res).toBe(1);
    expect(prisma.booking.findMany.mock.calls[0][0].where.businessId).toBe(BUSINESS_A);
  });
});

describe("getBookingSummary", () => {
  it("runs all counts scoped by businessId and returns a safe zeroed summary", async () => {
    prisma.booking.count.mockResolvedValue(0);
    const res = await getBookingSummary(tenant);
    expect(res).toEqual({
      todayCount: 0,
      weekCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
    });
    for (const call of prisma.booking.count.mock.calls) {
      expect(call[0].where.businessId).toBe(BUSINESS_A);
    }
  });
});
