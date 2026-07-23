import { prisma } from "@/server/db/prisma";
import type { SubscriptionStatus, SubscriptionPlan } from "@prisma/client";

export interface AdminBusinessFilters {
  q?: string;
  status?: string;
  plan?: string;
}

/** Cross-tenant stats for the admin overview. */
export async function getAdminOverviewStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBusinesses,
    trialCount,
    activeCount,
    discountedCount,
    suspendedOrCancelledCount,
    totalClients,
    bookingsThisMonth,
  ] = await Promise.all([
    prisma.business.count(),
    // Businesses on trial (explicit record) + businesses with no subscription record (default = trial)
    prisma.businessSubscription.count({ where: { status: "trial" } }).then(async (c) => {
      const withSub = await prisma.businessSubscription.count();
      const total = await prisma.business.count();
      return c + (total - withSub);
    }),
    prisma.businessSubscription.count({ where: { status: "active" } }),
    prisma.businessSubscription.count({ where: { status: "discounted" } }),
    prisma.businessSubscription.count({
      where: { status: { in: ["suspended", "cancelled"] } },
    }),
    prisma.client.count(),
    prisma.booking.count({ where: { startTime: { gte: monthStart } } }),
  ]);

  return {
    totalBusinesses,
    trialCount,
    activeCount,
    discountedCount,
    suspendedOrCancelledCount,
    totalClients,
    bookingsThisMonth,
  };
}

export interface AccountSubscriptionRevenue {
  /** Monthly recurring revenue from active subscriptions, in shekels. */
  mrr: number;
  /** MRR × 12 — annualised run-rate, in shekels. */
  arr: number;
  activeCount: number;
  premiumCount: number;
  platinumCount: number;
  pastDueCount: number;
  cancelledCount: number;
}

/**
 * Self-serve subscription revenue across all owners (owner→Allura billing).
 *
 * NOTE: this is the RECURRING run-rate (MRR/ARR) from currently-active
 * subscriptions — not lifetime cash collected. There is no per-charge ledger
 * (renewals only extend the period), so historical totals aren't derivable
 * from the schema; MRR is the meaningful "how much am I making" figure.
 */
export async function getAccountSubscriptionRevenue(): Promise<AccountSubscriptionRevenue> {
  const [activeSubs, pastDueCount, cancelledCount] = await Promise.all([
    prisma.accountSubscription.findMany({
      where: { status: "active" },
      select: { plan: true, priceMinor: true },
    }),
    prisma.accountSubscription.count({ where: { status: "past_due" } }),
    prisma.accountSubscription.count({ where: { status: "cancelled" } }),
  ]);

  let mrrMinor = 0;
  let premiumCount = 0;
  let platinumCount = 0;
  for (const s of activeSubs) {
    mrrMinor += s.priceMinor;
    if (s.plan === "platinum") platinumCount++;
    else premiumCount++;
  }

  return {
    mrr: mrrMinor / 100,
    arr: (mrrMinor * 12) / 100,
    activeCount: activeSubs.length,
    premiumCount,
    platinumCount,
    pastDueCount,
    cancelledCount,
  };
}

/** All businesses with owner info, subscription, and usage counts. */
export async function getAdminBusinesses(filters: AdminBusinessFilters = {}) {
  const { q, status, plan } = filters;

  const validStatuses: SubscriptionStatus[] = [
    "trial", "active", "discounted", "suspended", "cancelled", "pending_payment",
  ];
  const validPlans: SubscriptionPlan[] = ["basic", "pro"];

  const statusFilter = status && validStatuses.includes(status as SubscriptionStatus)
    ? (status as SubscriptionStatus)
    : undefined;
  const planFilter = plan && validPlans.includes(plan as SubscriptionPlan)
    ? (plan as SubscriptionPlan)
    : undefined;

  return prisma.business.findMany({
    where: {
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { slug: { contains: q, mode: "insensitive" } },
          {
            members: {
              some: {
                user: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ],
      }),
      ...(statusFilter && { subscription: { status: statusFilter } }),
      ...(planFilter && { subscription: { plan: planFilter } }),
    },
    include: {
      subscription: true,
      members: {
        where: { role: "owner" },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { clients: true, bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

/** Single business with full admin-visible details. */
export async function getAdminBusiness(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      subscription: true,
      members: {
        where: { role: "owner" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: true,
              isAdmin: true,
              planExpiresAt: true,
              suspendedUntil: true,
            },
          },
        },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { clients: true, bookings: true } },
    },
  });
}

/**
 * Summary used to render the admin "delete business" danger zone: record counts
 * plus owner info and whether the owner User row is safe to delete alongside
 * the business (only this business + not a platform admin).
 */
export async function getAdminBusinessDeletionSummary(businessId: string) {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        include: { user: { select: { id: true, name: true, email: true, isAdmin: true } } },
      },
      _count: {
        select: {
          clients: true,
          bookings: true,
          services: true,
          automationMessages: true,
        },
      },
    },
  });

  if (!biz) return null;

  const owner = biz.members[0]?.user ?? null;
  let ownerCanBeDeleted = false;
  let ownerOtherBusinessCount = 0;

  if (owner && !owner.isAdmin) {
    const membershipCount = await prisma.businessUser.count({
      where: { userId: owner.id },
    });
    ownerOtherBusinessCount = Math.max(0, membershipCount - 1);
    ownerCanBeDeleted = membershipCount === 1;
  }

  return {
    id: biz.id,
    name: biz.name,
    slug: biz.slug,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    ownerIsAdmin: owner?.isAdmin ?? false,
    clientCount: biz._count.clients,
    bookingCount: biz._count.bookings,
    serviceCount: biz._count.services,
    automationMessageCount: biz._count.automationMessages,
    ownerCanBeDeleted,
    ownerOtherBusinessCount,
  };
}

/** Booking count for a specific business in the current calendar month. */
export async function getAdminBusinessBookingsThisMonth(businessId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.booking.count({
    where: { businessId, startTime: { gte: monthStart } },
  });
}
