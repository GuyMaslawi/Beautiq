import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { Prisma } from "@prisma/client";

export type CampaignType = "30" | "60" | "90" | "vip";

export interface WinBackClient {
  id: string;
  fullName: string;
  phone: string;
  lastVisitAt: Date;
  lastServiceName: string;
  daysSinceLastVisit: number;
  totalCompletedBookings: number;
  totalRevenue: number;
}

export interface WinBackMetrics {
  totalRecoverable: number;
  revenuePotential: number;
}

const VIP_MIN_REVENUE = 500;
const VIP_MIN_BOOKINGS = 4;
const VIP_MIN_DAYS = 45;

function filterByType(clients: WinBackClient[], type: CampaignType): WinBackClient[] {
  switch (type) {
    case "30":
      return clients.filter(
        (c) => c.daysSinceLastVisit >= 30 && c.daysSinceLastVisit < 60,
      );
    case "60":
      return clients.filter(
        (c) => c.daysSinceLastVisit >= 60 && c.daysSinceLastVisit < 90,
      );
    case "90":
      return clients.filter((c) => c.daysSinceLastVisit >= 90);
    case "vip":
      return clients.filter(
        (c) =>
          c.daysSinceLastVisit >= VIP_MIN_DAYS &&
          (c.totalRevenue >= VIP_MIN_REVENUE || c.totalCompletedBookings >= VIP_MIN_BOOKINGS),
      );
  }
}

export async function getWinBackAllCampaigns(
  tenant: TenantContext,
): Promise<Record<CampaignType, WinBackClient[]>> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

  const processed: WinBackClient[] = clients
    .map((client) => {
      const completedBookings = client.bookings.filter(
        (b) => b.status === "completed",
      );
      const lastCompleted = completedBookings[0];
      if (!lastCompleted) return null;

      const daysSinceLastVisit = Math.floor(
        (now.getTime() - lastCompleted.startTime.getTime()) / (1000 * 60 * 60 * 24),
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
        totalCompletedBookings: completedBookings.length,
        totalRevenue,
      };
    })
    .filter((c): c is WinBackClient => c !== null)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  const campaignTypes: CampaignType[] = ["30", "60", "90", "vip"];
  return Object.fromEntries(
    campaignTypes.map((type) => [type, filterByType(processed, type)]),
  ) as Record<CampaignType, WinBackClient[]>;
}

export function computeWinBackMetrics(
  allCampaigns: Record<CampaignType, WinBackClient[]>,
): WinBackMetrics {
  // 30/60/90 are mutually exclusive; VIP may overlap — deduplicate
  const baseClients = [
    ...allCampaigns["30"],
    ...allCampaigns["60"],
    ...allCampaigns["90"],
  ];
  const baseIds = new Set(baseClients.map((c) => c.id));
  const vipOnly = allCampaigns.vip.filter((c) => !baseIds.has(c.id));
  const allUnique = [...baseClients, ...vipOnly];

  const totalRecoverable = allUnique.length;
  const revenuePotential = allUnique.reduce((sum, c) => {
    const avgPerVisit =
      c.totalCompletedBookings > 0 ? c.totalRevenue / c.totalCompletedBookings : 0;
    return sum + avgPerVisit;
  }, 0);

  return { totalRecoverable, revenuePotential };
}
