import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export const RETURNING_CLIENT_THRESHOLD_DAYS = 30;

export interface RetentionClient {
  id: string;
  fullName: string;
  phone: string;
  lastCompletedBookingAt: Date;
  lastServiceName: string;
  daysSinceLastVisit: number;
  totalCompletedBookings: number;
  hasNoShow: boolean;
  hasCancellations: boolean;
}

export interface RetentionSummary {
  notReturnedCount: number;
  withUpcomingCount: number;
}

export async function getRetentionClients(
  tenant: TenantContext,
): Promise<RetentionClient[]> {
  const now = new Date();
  const thresholdDate = new Date(
    now.getTime() - RETURNING_CLIENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );

  const clients = await prisma.client.findMany({
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
    include: {
      bookings: {
        where: { businessId: tenant.businessId },
        select: {
          status: true,
          startTime: true,
          service: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
  });

  return clients
    .map((client) => {
      const completedBookings = client.bookings.filter(
        (b) => b.status === "completed",
      );

      // The most recent completed booking is the last visit
      const lastCompleted = completedBookings[0];
      if (!lastCompleted) return null;

      const daysSinceLastVisit = Math.floor(
        (now.getTime() - lastCompleted.startTime.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        lastCompletedBookingAt: lastCompleted.startTime,
        lastServiceName: lastCompleted.service.name,
        daysSinceLastVisit,
        totalCompletedBookings: completedBookings.length,
        hasNoShow: client.bookings.some((b) => b.status === "no_show"),
        hasCancellations: client.bookings.some((b) => b.status === "cancelled"),
      };
    })
    .filter((c): c is RetentionClient => c !== null)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

export async function getRetentionSummary(
  tenant: TenantContext,
): Promise<RetentionSummary> {
  const now = new Date();
  const thresholdDate = new Date(
    now.getTime() - RETURNING_CLIENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );

  const [notReturnedCount, withUpcomingCount] = await Promise.all([
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
    prisma.client.count({
      where: {
        businessId: tenant.businessId,
        bookings: {
          some: {
            status: { in: ["pending", "approved"] },
            startTime: { gt: now },
          },
        },
      },
    }),
  ]);

  return { notReturnedCount, withUpcomingCount };
}
