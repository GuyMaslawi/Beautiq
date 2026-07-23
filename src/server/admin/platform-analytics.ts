/**
 * Cross-tenant "god view" analytics for the platform admin overview.
 *
 * Aggregates activity ACROSS all businesses: platform GMV (gross booking value),
 * revenue/booking leaderboards, signup trend, and active-vs-dormant engagement.
 * This is operational insight into how the whole platform is being used — it is
 * distinct from subscription MRR (owner→Allura billing) shown separately.
 *
 * Server-only. Admin-gated at the call site (requirePlatformAdmin).
 */

import { prisma } from "@/server/db/prisma";
import { getDateRangeForPeriod } from "@/server/finance/queries";
import type { ActivityCategory, ActivityActorType } from "@prisma/client";

const TZ = "Asia/Jerusalem";

export interface LeaderRow {
  businessId: string;
  name: string;
  slug: string;
  value: number;
}

export interface SignupBucket {
  /** Hebrew month label, e.g. "יולי". */
  label: string;
  count: number;
}

export interface DormantRow {
  businessId: string;
  name: string;
  slug: string;
  ownerName: string | null;
  createdAt: Date;
  lastBookingAt: Date | null;
}

export interface PlatformAnalytics {
  /** Gross booking value (completed) this / last calendar month, in shekels. */
  gmvThisMonth: number;
  gmvLastMonth: number;
  /** Businesses with ≥1 booking created this month. */
  activeBusinessesThisMonth: number;
  totalBusinesses: number;
  newBusinessesThisMonth: number;

  revenueLeaders: LeaderRow[];
  bookingLeaders: LeaderRow[];
  signupTrend: SignupBucket[];
  dormant: DormantRow[];
}

/** Look up name+slug for a set of business ids, preserving nothing about order. */
async function nameMap(ids: string[]): Promise<Map<string, { name: string; slug: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.business.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true },
  });
  return new Map(rows.map((r) => [r.id, { name: r.name, slug: r.slug }]));
}

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getDateRangeForPeriod("month");
  // Last calendar month bounds (simple UTC-ish; good enough for a monthly rollup).
  const lastMonthStart = new Date(monthStart.getTime() - 1);
  const lmStart = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth(), 1);
  const cutoff30 = new Date(now.getTime() - 30 * 86400000);
  const cutoff14 = new Date(now.getTime() - 14 * 86400000);

  const [
    gmvThisAgg,
    gmvLastAgg,
    revenueGroups,
    bookingGroups,
    totalBusinesses,
    newBusinessesThisMonth,
    allCreatedAt,
    dormantRaw,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { status: "completed", startTime: { gte: monthStart, lte: monthEnd } },
      _sum: { priceSnapshot: true },
    }),
    prisma.booking.aggregate({
      where: { status: "completed", startTime: { gte: lmStart, lt: monthStart } },
      _sum: { priceSnapshot: true },
    }),
    // Revenue leaderboard — completed booking value per business this month.
    prisma.booking.groupBy({
      by: ["businessId"],
      where: { status: "completed", startTime: { gte: monthStart, lte: monthEnd } },
      _sum: { priceSnapshot: true },
      orderBy: { _sum: { priceSnapshot: "desc" } },
      take: 8,
    }),
    // Booking-volume leaderboard + active-business set — bookings created this month.
    prisma.booking.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
      _count: { businessId: true },
      orderBy: { _count: { businessId: "desc" } },
    }),
    prisma.business.count(),
    prisma.business.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.business.findMany({ select: { createdAt: true } }),
    // Dormant: onboarded >14d ago, no booking created in the last 30 days.
    prisma.business.findMany({
      where: {
        createdAt: { lt: cutoff14 },
        bookings: { none: { createdAt: { gte: cutoff30 } } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        members: {
          where: { role: "owner" },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { user: { select: { name: true } } },
        },
      },
    }),
  ]);

  // Revenue leaders
  const revIds = revenueGroups.map((g) => g.businessId);
  const revNames = await nameMap(revIds);
  const revenueLeaders: LeaderRow[] = revenueGroups
    .map((g) => ({
      businessId: g.businessId,
      name: revNames.get(g.businessId)?.name ?? "—",
      slug: revNames.get(g.businessId)?.slug ?? "",
      value: Number(g._sum?.priceSnapshot ?? 0),
    }))
    .filter((r) => r.value > 0);

  // Booking leaders (top 8) + active count (full set length)
  const activeBusinessesThisMonth = bookingGroups.length;
  const topBooking = bookingGroups.slice(0, 8);
  const bookNames = await nameMap(topBooking.map((g) => g.businessId));
  const bookingLeaders: LeaderRow[] = topBooking.map((g) => ({
    businessId: g.businessId,
    name: bookNames.get(g.businessId)?.name ?? "—",
    slug: bookNames.get(g.businessId)?.slug ?? "",
    value: g._count.businessId,
  }));

  // Signup trend — last 6 months, bucketed by Jerusalem month.
  const signupTrend = buildSignupTrend(allCreatedAt.map((b) => b.createdAt));

  // Dormant — fetch last booking date for each (small set).
  const dormant: DormantRow[] = await Promise.all(
    dormantRaw.map(async (b) => {
      const last = await prisma.booking.findFirst({
        where: { businessId: b.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return {
        businessId: b.id,
        name: b.name,
        slug: b.slug,
        ownerName: b.members[0]?.user.name ?? null,
        createdAt: b.createdAt,
        lastBookingAt: last?.createdAt ?? null,
      };
    }),
  );

  return {
    gmvThisMonth: Number(gmvThisAgg._sum?.priceSnapshot ?? 0),
    gmvLastMonth: Number(gmvLastAgg._sum?.priceSnapshot ?? 0),
    activeBusinessesThisMonth,
    totalBusinesses,
    newBusinessesThisMonth,
    revenueLeaders,
    bookingLeaders,
    signupTrend,
    dormant,
  };
}

// ---------------------------------------------------------------------------
// Recent platform-wide activity feed
// ---------------------------------------------------------------------------

export interface PlatformActivityRow {
  id: string;
  category: ActivityCategory;
  actorType: ActivityActorType;
  summary: string;
  createdAt: Date;
  businessId: string | null;
  businessName: string | null;
  actorLabel: string | null;
}

/** Newest logged actions across every business + account-level events. */
export async function getRecentPlatformActivity(
  limit = 25,
): Promise<PlatformActivityRow[]> {
  const rows = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      actorType: true,
      summary: true,
      createdAt: true,
      businessId: true,
      business: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    actorType: r.actorType,
    summary: r.summary,
    createdAt: r.createdAt,
    businessId: r.businessId,
    businessName: r.business?.name ?? null,
    actorLabel: r.user?.name ?? r.user?.email ?? null,
  }));
}

function buildSignupTrend(dates: Date[]): SignupBucket[] {
  const now = new Date();
  const buckets: SignupBucket[] = [];
  const keyOf = (d: Date) =>
    `${d.toLocaleString("en", { timeZone: TZ, year: "numeric" })}-${d.toLocaleString("en", { timeZone: TZ, month: "2-digit" })}`;

  // Prepare 6 month buckets (oldest → newest)
  const monthKeys: string[] = [];
  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    labels.push(d.toLocaleString("he-IL", { month: "long" }));
  }

  const counts = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const d of dates) {
    const k = keyOf(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  for (let i = 0; i < monthKeys.length; i++) {
    buckets.push({ label: labels[i], count: counts.get(monthKeys[i]) ?? 0 });
  }
  return buckets;
}
