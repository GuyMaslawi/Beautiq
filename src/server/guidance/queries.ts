import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { RECENT_COMPLETED_BOOKINGS_DAYS } from "@/lib/reputation/constants";
import { getPricingConcernCount } from "@/server/pricing/queries";

export const RETURNING_CLIENT_THRESHOLD_DAYS = 30;

export interface GuidanceQueryData {
  activeServicesCount: number;
  activeAvailabilityCount: number;
  todayBookingsCount: number;
  pendingBookingsCount: number;
  lostClientsCount: number;
  noShowClientsCount: number;
  upcomingBookingsCount: number;
  recentCompletedBookingsCount: number;
  pricingConcernCount: number;
}

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

export async function getGuidanceData(
  tenant: TenantContext,
): Promise<GuidanceQueryData> {
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getJerusalemTodayBounds();
  const thresholdDate = new Date(
    now.getTime() - RETURNING_CLIENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );
  const reputationSinceDate = new Date(
    now.getTime() - RECENT_COMPLETED_BOOKINGS_DAYS * 24 * 60 * 60 * 1000,
  );

  const [
    activeServicesCount,
    activeAvailabilityCount,
    todayBookingsCount,
    pendingBookingsCount,
    lostClientsCount,
    noShowClientsCount,
    upcomingBookingsCount,
    recentCompletedBookingsCount,
    pricingConcernCount,
  ] = await Promise.all([
    prisma.service.count({
      where: { businessId: tenant.businessId, isActive: true },
    }),

    prisma.availabilityRule.count({
      where: { businessId: tenant.businessId, isActive: true },
    }),

    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ["pending", "approved"] },
      },
    }),

    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        status: "pending",
      },
    }),

    // Clients with a completed booking older than 30 days and no upcoming booking
    // — computed from bookings so the denormalized lastVisitAt field doesn't need to be in sync
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: {
          some: {
            status: "completed",
            startTime: { lt: thresholdDate },
          },
          none: {
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    }),

    // Clients who have at least one no_show booking
    // — computed from bookings so the denormalized noShowCount field doesn't need to be in sync
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: { some: { status: "no_show" } },
      },
    }),

    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        status: { in: ["pending", "approved"] },
        startTime: { gt: now },
      },
    }),

    prisma.booking.count({
      where: {
        businessId: tenant.businessId,
        status: "completed",
        startTime: { gte: reputationSinceDate },
      },
    }),

    getPricingConcernCount(tenant),
  ]);

  return {
    activeServicesCount,
    activeAvailabilityCount,
    todayBookingsCount,
    pendingBookingsCount,
    lostClientsCount,
    noShowClientsCount,
    upcomingBookingsCount,
    recentCompletedBookingsCount,
    pricingConcernCount,
  };
}
