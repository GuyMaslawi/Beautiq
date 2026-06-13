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
        include: { user: { select: { id: true, name: true, email: true } } },
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
