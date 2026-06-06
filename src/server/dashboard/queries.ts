import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  bookingsToday: number;
  totalClients: number;
  activeServices: number;
  monthRevenue: number; // raw amount in ILS
}

export interface SetupState {
  hasCategories: boolean;
  hasActiveService: boolean;
  hasAvailabilityRule: boolean;
  hasProfileDetails: boolean;
  hasAnyBookings: boolean;
}

export interface UpcomingBookingItem {
  id: string;
  clientName: string;
  serviceName: string;
  startTimeISO: string;
  status: "pending" | "approved";
}

export interface DashboardData {
  metrics: DashboardMetrics;
  setup: SetupState;
  upcomingBookings: UpcomingBookingItem[];
}

// ---------------------------------------------------------------------------
// Jerusalem timezone helpers
//
// Bookings are stored as UTC instants in PostgreSQL. To filter "today" and
// "this month" we compute the UTC boundaries of those periods in the
// Asia/Jerusalem timezone without an external library.
//
// Approach: ask Intl.DateTimeFormat how far into the Jerusalem day a given
// UTC instant is, then subtract that offset to find the UTC start-of-day.
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

function getJerusalemTodayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = getJerusalemDayStart(now);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
}

function getJerusalemMonthBounds(): { start: Date; end: Date } {
  const now = new Date();

  const ymParts = new Intl.DateTimeFormat("en", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parseInt(ymParts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(ymParts.find((p) => p.type === "month")!.value, 10); // 1-indexed

  // Noon UTC on day 1 of the Jerusalem month — always within this month at UTC+2/+3
  const day1NoonUTC = new Date(Date.UTC(year, month - 1, 1, 12));
  const monthStart = getJerusalemDayStart(day1NoonUTC);

  // Last calendar day of the month
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayNoonUTC = new Date(Date.UTC(year, month - 1, lastDayNum, 12));
  const lastDayStart = getJerusalemDayStart(lastDayNoonUTC);
  const monthEnd = new Date(lastDayStart.getTime() + 86400000 - 1);

  return { start: monthStart, end: monthEnd };
}

// ---------------------------------------------------------------------------
// Main query — all dashboard data in a single parallel batch
// ---------------------------------------------------------------------------

export async function getDashboardData(
  tenant: TenantContext,
  businessProfile: {
    phone: string | null;
    description: string | null;
    city: string | null;
    area: string | null;
    addressNote: string | null;
  },
): Promise<DashboardData> {
  const { start: todayStart, end: todayEnd } = getJerusalemTodayBounds();
  const { start: monthStart, end: monthEnd } = getJerusalemMonthBounds();
  const now = new Date();

  const [
    bookingsToday,
    totalClients,
    activeServicesCount,
    monthRevenueAgg,
    categoriesCount,
    availabilityCount,
    totalBookingsCount,
    upcomingRaw,
  ] = await Promise.all([
    // תורים להיום — pending, approved, completed only
    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["pending", "approved", "completed"] },
      },
    }),

    // סך לקוחות
    prisma.client.count({
      where: { businessId: tenant.businessId },
    }),

    // שירותים פעילים
    prisma.service.count({
      where: { businessId: tenant.businessId, isActive: true },
    }),

    // הכנסות החודש — sum of priceSnapshot for completed bookings this month
    prisma.booking.aggregate({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: monthStart, lte: monthEnd },
      },
      _sum: { priceSnapshot: true },
    }),

    // האם יש תחומי פעילות
    prisma.businessCategoryOnBusiness.count({
      where: { businessId: tenant.businessId },
    }),

    // האם יש כלל זמינות פעיל
    prisma.availabilityRule.count({
      where: { businessId: tenant.businessId, isActive: true },
    }),

    // האם קיים תור כלשהו
    prisma.booking.count({
      where: { businessId: tenant.businessId },
    }),

    // תורים קרובים — next 3 upcoming (pending or approved)
    prisma.booking.findMany({
      where: {
        businessId: tenant.businessId,
        status: { in: ["pending", "approved"] },
        startTime: { gt: now },
      },
      orderBy: { startTime: "asc" },
      take: 3,
      select: {
        id: true,
        startTime: true,
        status: true,
        client: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    }),
  ]);

  const monthRevenue = Number(monthRevenueAgg._sum.priceSnapshot ?? 0);

  const hasProfileDetails = !!(
    businessProfile.phone ||
    businessProfile.description ||
    businessProfile.city ||
    businessProfile.area ||
    businessProfile.addressNote
  );

  return {
    metrics: {
      bookingsToday,
      totalClients,
      activeServices: activeServicesCount,
      monthRevenue,
    },
    setup: {
      hasCategories: categoriesCount > 0,
      hasActiveService: activeServicesCount > 0,
      hasAvailabilityRule: availabilityCount > 0,
      hasProfileDetails,
      hasAnyBookings: totalBookingsCount > 0,
    },
    upcomingBookings: upcomingRaw.map((b) => ({
      id: b.id,
      clientName: b.client.fullName,
      serviceName: b.service.name,
      startTimeISO: b.startTime.toISOString(),
      status: b.status as "pending" | "approved",
    })),
  };
}
