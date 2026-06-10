import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { Prisma } from "@prisma/client";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AtRiskClient {
  id: string;
  fullName: string;
  phone: string;
  lastVisitAt: Date;
  lastServiceName: string;
  daysSinceLastVisit: number;
  riskLevel: RiskLevel;
  totalCompletedBookings: number;
  totalRevenue: number;
}

export interface AtRiskSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
}

function getRiskLevel(days: number): RiskLevel {
  if (days >= 90) return "critical";
  if (days >= 60) return "high";
  if (days >= 45) return "medium";
  return "low";
}

export async function getAtRiskClients(
  tenant: TenantContext,
): Promise<AtRiskClient[]> {
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
        (sum, b) =>
          sum + (b.priceSnapshot as Prisma.Decimal).toNumber(),
        0,
      );

      return {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        lastVisitAt: lastCompleted.startTime,
        lastServiceName: lastCompleted.service.name,
        daysSinceLastVisit,
        riskLevel: getRiskLevel(daysSinceLastVisit),
        totalCompletedBookings: completedBookings.length,
        totalRevenue,
      };
    })
    .filter((c): c is AtRiskClient => c !== null)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

export async function getAtRiskSummary(
  tenant: TenantContext,
): Promise<AtRiskSummary> {
  const clients = await getAtRiskClients(tenant);
  return {
    total: clients.length,
    critical: clients.filter((c) => c.riskLevel === "critical").length,
    high: clients.filter((c) => c.riskLevel === "high").length,
    medium: clients.filter((c) => c.riskLevel === "medium").length,
  };
}
