import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { Prisma } from "@prisma/client";

export const DEFAULT_RETURN_WINDOW_DAYS = 30;
export const MIN_RETURN_WINDOW_DAYS = 14;
export const MAX_RETURN_WINDOW_DAYS = 180;

export type ClientSegment = "critical" | "high" | "medium";

export interface BringBackClient {
  id: string;
  fullName: string;
  phone: string;
  lastVisitAt: Date;
  lastServiceName: string;
  daysSinceLastVisit: number;
  segment: ClientSegment;
  totalCompletedBookings: number;
  totalRevenue: number;
}

export interface BringBackSummary {
  total: number;
  /** 90+ days */
  critical: number;
  /** 60–89 days */
  high: number;
  /** threshold–59 days */
  medium: number;
}

function getSegment(days: number): ClientSegment {
  if (days >= 90) return "critical";
  if (days >= 60) return "high";
  return "medium";
}

export async function getBringBackClients(
  tenant: TenantContext,
  thresholdDays: number = DEFAULT_RETURN_WINDOW_DAYS,
): Promise<BringBackClient[]> {
  const now = new Date();
  const thresholdDate = new Date(
    now.getTime() - thresholdDays * 24 * 60 * 60 * 1000,
  );

  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      bookings: {
        some: {
          businessId: tenant.businessId,
          status: "completed",
          startTime: { lt: thresholdDate },
        },
        none: {
          businessId: tenant.businessId,
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
          priceSnapshot: true,
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
      const lastCompleted = completedBookings[0];
      if (!lastCompleted) return null;

      const daysSinceLastVisit = Math.floor(
        (now.getTime() - lastCompleted.startTime.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const totalRevenue = completedBookings.reduce(
        (sum, b) => sum + (b.priceSnapshot as Prisma.Decimal).toNumber(),
        0,
      );

      return {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        lastVisitAt: lastCompleted.startTime,
        lastServiceName: lastCompleted.service.name,
        daysSinceLastVisit,
        segment: getSegment(daysSinceLastVisit),
        totalCompletedBookings: completedBookings.length,
        totalRevenue,
      };
    })
    .filter((c): c is BringBackClient => c !== null)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

export function computeBringBackSummary(clients: BringBackClient[]): BringBackSummary {
  return {
    total: clients.length,
    critical: clients.filter((c) => c.segment === "critical").length,
    high: clients.filter((c) => c.segment === "high").length,
    medium: clients.filter((c) => c.segment === "medium").length,
  };
}
