import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopService {
  id: string;
  name: string;
  bookingsCount: number;
  revenue: number;
  avgPrice: number;
}

export interface RevenueForecastData {
  // Current month actuals
  completedRevenue: number;
  completedBookingsCount: number;

  // Current month upcoming (approved, within this month)
  upcomingRevenue: number;
  upcomingBookingsCount: number;

  // Expected = completed + upcoming
  expectedRevenue: number;

  // Lost this month (cancelled + no_show with a priceSnapshot)
  lostRevenue: number;
  lostBookingsCount: number;

  // Monthly target derived from last month
  lastMonthRevenue: number;
  lastMonthCompletedCount: number;
  monthlyTarget: number;
  hasEnoughData: boolean; // false when lastMonth = 0 and completedRevenue = 0
  // true only when last month had ≥3 completed bookings (meaningful baseline)
  targetReliable: boolean;

  // Gap
  gapToTarget: number; // monthlyTarget - expectedRevenue (0 if expected >= target)
  isOnTrack: boolean; // only meaningful when targetReliable = true

  // Day progress
  daysPassed: number;
  totalDays: number;
  expectedProgressPct: number; // % of month elapsed
  actualProgressPct: number;   // completed / target * 100 (capped at 100)

  // Average booking value
  avgBookingValue: number;

  // Confidence
  confidence: "high" | "medium" | "low";

  // Top services this month
  topServices: TopService[];

  // Action context
  pendingDepositsCount: number;
  atRiskCount: number;
  emptySlotsCount: number;
  avgServicePrice: number; // for empty slot revenue estimate
}

// ---------------------------------------------------------------------------
// Jerusalem timezone helpers (mirrors dashboard/queries.ts)
// ---------------------------------------------------------------------------

const TZ = "Asia/Jerusalem";

function getJerusalemDayStart(refDate: Date): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(refDate);

  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const s = parseInt(parts.find((p) => p.type === "second")!.value, 10);

  return new Date(
    refDate.getTime() - (h * 3600 + m * 60 + s) * 1000 - refDate.getMilliseconds(),
  );
}

function getJerusalemMonthBounds(monthOffset = 0): { start: Date; end: Date; totalDays: number } {
  const now = new Date();

  const ymParts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  let year = parseInt(ymParts.find((p) => p.type === "year")!.value, 10);
  let month = parseInt(ymParts.find((p) => p.type === "month")!.value, 10); // 1-indexed

  // Adjust month by offset
  month += monthOffset;
  if (month < 1) {
    month += 12;
    year -= 1;
  } else if (month > 12) {
    month -= 12;
    year += 1;
  }

  const day1NoonUTC = new Date(Date.UTC(year, month - 1, 1, 12));
  const monthStart = getJerusalemDayStart(day1NoonUTC);

  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayNoonUTC = new Date(Date.UTC(year, month - 1, lastDayNum, 12));
  const lastDayStart = getJerusalemDayStart(lastDayNoonUTC);
  const monthEnd = new Date(lastDayStart.getTime() + 86400000 - 1);

  return { start: monthStart, end: monthEnd, totalDays: lastDayNum };
}

function getDaysPassed(): number {
  const now = new Date();
  const todayStart = getJerusalemDayStart(now);

  const ymParts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parseInt(ymParts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(ymParts.find((p) => p.type === "month")!.value, 10);

  const day1NoonUTC = new Date(Date.UTC(year, month - 1, 1, 12));
  const monthStart = getJerusalemDayStart(day1NoonUTC);

  return Math.floor((todayStart.getTime() - monthStart.getTime()) / 86400000) + 1;
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getRevenueForecastData(
  tenant: TenantContext,
): Promise<RevenueForecastData> {
  const now = new Date();
  const { start: monthStart, end: monthEnd, totalDays } = getJerusalemMonthBounds(0);
  const { start: lastMonthStart, end: lastMonthEnd } = getJerusalemMonthBounds(-1);
  const daysPassed = getDaysPassed();

  const [
    completedAgg,
    upcomingAgg,
    lostAgg,
    lastMonthAgg,
    completedBookings,
    pendingDepositsCount,
    atRiskCount,
    avgServiceAgg,
    activeServicesCount,
  ] = await Promise.all([
    // Completed bookings this month
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: monthStart, lte: monthEnd },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Approved upcoming bookings still within this month (future)
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "approved",
        startTime: { gt: now, lte: monthEnd },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Cancelled + no_show this month with a price
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: { in: ["cancelled", "no_show"] },
        startTime: { gte: monthStart, lte: monthEnd },
        priceSnapshot: { gt: 0 },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Last month completed revenue + count
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { priceSnapshot: true },
      _count: true,
    }),

    // Completed bookings this month with service info (for top services)
    prisma.booking.findMany({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: monthStart, lte: monthEnd },
      },
      select: {
        priceSnapshot: true,
        service: { select: { id: true, name: true } },
      },
    }),

    // Pending deposits — upcoming bookings where deposit is expected but not paid
    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        status: { in: ["pending", "approved"] },
        startTime: { gt: now },
        depositStatus: "pending",
      },
    }),

    // At-risk clients: completed booking older than 30 days, no upcoming booking
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: {
          some: {
            status: "completed",
            startTime: { lt: new Date(now.getTime() - 30 * 86400000) },
          },
          none: {
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    }),

    // Average service price for empty slot estimate
    prisma.service.aggregate({
      where: { businessId: tenant.businessId, isActive: true, price: { gt: 0 } },
      _avg: { price: true },
    }),

    // Active services count (to detect if enough setup exists)
    prisma.service.count({
      where: { businessId: tenant.businessId, isActive: true },
    }),
  ]);

  // ---------------------------------------------------------------------------
  // Derive metrics
  // ---------------------------------------------------------------------------

  const completedRevenue = Number(completedAgg._sum?.priceSnapshot ?? 0);
  const completedBookingsCount = completedAgg._count;

  const upcomingRevenue = Number(upcomingAgg._sum?.priceSnapshot ?? 0);
  const upcomingBookingsCount = upcomingAgg._count;

  const expectedRevenue = completedRevenue + upcomingRevenue;

  const lostRevenue = Number(lostAgg._sum?.priceSnapshot ?? 0);
  const lostBookingsCount = lostAgg._count;

  const lastMonthRevenue = Number(lastMonthAgg._sum.priceSnapshot ?? 0);
  const lastMonthCompletedCount = lastMonthAgg._count;

  // Monthly target
  const hasEnoughData = lastMonthRevenue > 0 || completedRevenue > 0;
  // A reliable target requires ≥3 completed bookings last month so the baseline is meaningful
  const targetReliable = lastMonthCompletedCount >= 3;
  const monthlyTarget =
    lastMonthRevenue > 0
      ? Math.round(lastMonthRevenue * 1.15)
      : expectedRevenue > 0
        ? Math.round(expectedRevenue * 1.15)
        : 0;

  const gapToTarget = Math.max(0, monthlyTarget - expectedRevenue);
  // isOnTrack is only valid when we have a reliable baseline
  const isOnTrack = targetReliable && expectedRevenue >= monthlyTarget;

  const expectedProgressPct = Math.round((daysPassed / totalDays) * 100);
  const actualProgressPct =
    monthlyTarget > 0
      ? Math.min(100, Math.round((completedRevenue / monthlyTarget) * 100))
      : 0;

  const avgBookingValue =
    completedBookingsCount > 0
      ? Math.round(completedRevenue / completedBookingsCount)
      : 0;

  // Confidence
  let confidence: "high" | "medium" | "low";
  if (completedBookingsCount >= 5 && (upcomingBookingsCount >= 3 || daysPassed > 20)) {
    confidence = "high";
  } else if (completedBookingsCount >= 2 || upcomingBookingsCount >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Top services
  const serviceMap = new Map<string, { name: string; count: number; total: number }>();
  for (const b of completedBookings) {
    const svc = b.service;
    const price = Number(b.priceSnapshot ?? 0);
    const existing = serviceMap.get(svc.id);
    if (existing) {
      existing.count += 1;
      existing.total += price;
    } else {
      serviceMap.set(svc.id, { name: svc.name, count: 1, total: price });
    }
  }

  const topServices: TopService[] = Array.from(serviceMap.entries())
    .map(([id, { name, count, total }]) => ({
      id,
      name,
      bookingsCount: count,
      revenue: total,
      avgPrice: count > 0 ? Math.round(total / count) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const avgServicePrice = Number(avgServiceAgg._avg?.price ?? 0);

  // Empty slots estimate: use at-risk clients or active services as a proxy
  // We use atRiskCount as the emptySlotsCount proxy here (actual slot computation
  // is expensive; the dashboard already has dedicated slot calculation)
  const emptySlotsCount = activeServicesCount > 0 ? Math.max(0, 7 - upcomingBookingsCount) : 0;

  return {
    completedRevenue,
    completedBookingsCount,
    upcomingRevenue,
    upcomingBookingsCount,
    expectedRevenue,
    lostRevenue,
    lostBookingsCount,
    lastMonthRevenue,
    lastMonthCompletedCount,
    monthlyTarget,
    hasEnoughData,
    targetReliable,
    gapToTarget,
    isOnTrack,
    daysPassed,
    totalDays,
    expectedProgressPct,
    actualProgressPct,
    avgBookingValue,
    confidence,
    topServices,
    pendingDepositsCount,
    atRiskCount,
    emptySlotsCount,
    avgServicePrice,
  };
}
