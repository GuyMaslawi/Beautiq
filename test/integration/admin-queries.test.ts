import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeBusiness, makeUser } from "../helpers/factories";

/**
 * Admin cross-tenant queries (server/admin/queries.ts).
 *
 * These are read-only platform-admin views. They are NOT business-scoped by
 * design (the admin sees every tenant), but per-business helpers must still pass
 * the businessId through to Prisma. We assert the filter/where shapes and the
 * derived stats are correct, and that no secrets are read.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

beforeEach(() => {
  resetPrismaMock(prisma);
});

import {
  getAdminOverviewStats,
  getAdminBusinesses,
  getAdminBusiness,
  getAdminBusinessDeletionSummary,
  getAdminBusinessBookingsThisMonth,
} from "@/server/admin/queries";

describe("getAdminOverviewStats", () => {
  it("aggregates platform counts and computes trial = explicit trials + businesses with no subscription", async () => {
    // business.count is called twice: once for totalBusinesses, once inside the trial reducer.
    prisma.business.count.mockResolvedValue(10);
    // Resolve businessSubscription.count by the where argument so call ordering
    // (Promise.all vs the .then reducer) is irrelevant.
    prisma.businessSubscription.count.mockImplementation(async (args?: { where?: { status?: unknown } }) => {
      const status = args?.where?.status;
      if (status === "trial") return 3;
      if (status === "active") return 4;
      if (status === "discounted") return 1;
      if (status && typeof status === "object") return 2; // { in: [suspended, cancelled] }
      return 6; // no-args total subscription count
    });
    prisma.client.count.mockResolvedValue(120);
    prisma.booking.count.mockResolvedValue(45);

    const stats = await getAdminOverviewStats();

    expect(stats.totalBusinesses).toBe(10);
    // 3 explicit trials + (10 total businesses - 6 with subscription) = 3 + 4 = 7
    expect(stats.trialCount).toBe(7);
    expect(stats.activeCount).toBe(4);
    expect(stats.discountedCount).toBe(1);
    expect(stats.suspendedOrCancelledCount).toBe(2);
    expect(stats.totalClients).toBe(120);
    expect(stats.bookingsThisMonth).toBe(45);

    // bookings counted from the start of the current month
    const bookingWhere = prisma.booking.count.mock.calls[0][0] as {
      where: { startTime: { gte: Date } };
    };
    expect(bookingWhere.where.startTime.gte).toBeInstanceOf(Date);
    const monthStart = bookingWhere.where.startTime.gte;
    expect(monthStart.getDate()).toBe(1);
  });
});

describe("getAdminBusinesses", () => {
  beforeEach(() => {
    prisma.business.findMany.mockResolvedValue([makeBusiness()]);
  });

  it("returns businesses with owner, subscription and usage counts; capped at 300", async () => {
    await getAdminBusinesses();
    const arg = prisma.business.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.take).toBe(300);
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    const include = arg.include as Record<string, unknown>;
    expect(include.subscription).toBe(true);
    expect(include._count).toEqual({ select: { clients: true, bookings: true } });
    // no filters => empty where
    expect(arg.where).toEqual({});
  });

  it("builds a search OR across name/phone/slug and owner name/email when q is given", async () => {
    await getAdminBusinesses({ q: "עדי" });
    const arg = prisma.business.findMany.mock.calls[0][0] as {
      where: { OR?: unknown[] };
    };
    expect(Array.isArray(arg.where.OR)).toBe(true);
    expect(arg.where.OR).toHaveLength(4);
  });

  it("applies a valid status filter", async () => {
    await getAdminBusinesses({ status: "active" });
    const arg = prisma.business.findMany.mock.calls[0][0] as {
      where: { subscription?: { status?: string } };
    };
    expect(arg.where.subscription).toEqual({ status: "active" });
  });

  it("ignores an invalid status filter (no subscription where injected)", async () => {
    await getAdminBusinesses({ status: "bogus" });
    const arg = prisma.business.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.subscription).toBeUndefined();
  });

  it("applies a valid plan filter", async () => {
    await getAdminBusinesses({ plan: "pro" });
    const arg = prisma.business.findMany.mock.calls[0][0] as {
      where: { subscription?: { plan?: string } };
    };
    expect(arg.where.subscription).toEqual({ plan: "pro" });
  });

  it("ignores an invalid plan filter", async () => {
    await getAdminBusinesses({ plan: "enterprise" });
    const arg = prisma.business.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where.subscription).toBeUndefined();
  });
});

describe("getAdminBusiness", () => {
  it("looks up by id with owner + subscription + counts", async () => {
    prisma.business.findUnique.mockResolvedValue(makeBusiness());
    await getAdminBusiness(BUSINESS_A);
    const arg = prisma.business.findUnique.mock.calls[0][0] as {
      where: { id: string };
      include: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: BUSINESS_A });
    expect(arg.include.subscription).toBe(true);
  });
});

describe("getAdminBusinessDeletionSummary", () => {
  it("returns null when the business does not exist", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await getAdminBusinessDeletionSummary(BUSINESS_A);
    expect(res).toBeNull();
  });

  it("marks owner deletable when they belong to only this business and are not admin", async () => {
    const owner = makeUser({ id: "usr_owner", isAdmin: false });
    prisma.business.findUnique.mockResolvedValue({
      id: BUSINESS_A,
      name: "סטודיו",
      slug: "studio",
      members: [{ user: owner }],
      _count: { clients: 3, bookings: 7, services: 2, automationMessages: 4 },
    });
    prisma.businessUser.count.mockResolvedValue(1);

    const res = await getAdminBusinessDeletionSummary(BUSINESS_A);
    expect(res).not.toBeNull();
    expect(res!.ownerId).toBe("usr_owner");
    expect(res!.ownerCanBeDeleted).toBe(true);
    expect(res!.ownerOtherBusinessCount).toBe(0);
    expect(res!.clientCount).toBe(3);
    expect(res!.bookingCount).toBe(7);
    expect(res!.serviceCount).toBe(2);
    expect(res!.automationMessageCount).toBe(4);
    expect(prisma.businessUser.count).toHaveBeenCalledWith({
      where: { userId: "usr_owner" },
    });
  });

  it("is not deletable when owner belongs to multiple businesses; reports the other count", async () => {
    const owner = makeUser({ id: "usr_owner", isAdmin: false });
    prisma.business.findUnique.mockResolvedValue({
      id: BUSINESS_A,
      name: "סטודיו",
      slug: "studio",
      members: [{ user: owner }],
      _count: { clients: 0, bookings: 0, services: 0, automationMessages: 0 },
    });
    prisma.businessUser.count.mockResolvedValue(3);

    const res = await getAdminBusinessDeletionSummary(BUSINESS_A);
    expect(res!.ownerCanBeDeleted).toBe(false);
    expect(res!.ownerOtherBusinessCount).toBe(2);
  });

  it("never marks a platform-admin owner as deletable and skips the membership count", async () => {
    const owner = makeUser({ id: "usr_admin", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue({
      id: BUSINESS_A,
      name: "סטודיו",
      slug: "studio",
      members: [{ user: owner }],
      _count: { clients: 0, bookings: 0, services: 0, automationMessages: 0 },
    });

    const res = await getAdminBusinessDeletionSummary(BUSINESS_A);
    expect(res!.ownerIsAdmin).toBe(true);
    expect(res!.ownerCanBeDeleted).toBe(false);
    expect(prisma.businessUser.count).not.toHaveBeenCalled();
  });

  it("handles a business with no owner member", async () => {
    prisma.business.findUnique.mockResolvedValue({
      id: BUSINESS_A,
      name: "סטודיו",
      slug: "studio",
      members: [],
      _count: { clients: 0, bookings: 0, services: 0, automationMessages: 0 },
    });
    const res = await getAdminBusinessDeletionSummary(BUSINESS_A);
    expect(res!.ownerId).toBeNull();
    expect(res!.ownerName).toBeNull();
    expect(res!.ownerEmail).toBeNull();
    expect(res!.ownerIsAdmin).toBe(false);
    expect(res!.ownerCanBeDeleted).toBe(false);
    expect(prisma.businessUser.count).not.toHaveBeenCalled();
  });
});

describe("getAdminBusinessBookingsThisMonth", () => {
  it("counts bookings scoped to the businessId from month start", async () => {
    prisma.booking.count.mockResolvedValue(12);
    const res = await getAdminBusinessBookingsThisMonth(BUSINESS_A);
    expect(res).toBe(12);
    const arg = prisma.booking.count.mock.calls[0][0] as {
      where: { businessId: string; startTime: { gte: Date } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.startTime.gte.getDate()).toBe(1);
  });
});
