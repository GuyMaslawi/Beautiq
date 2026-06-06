import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export async function getWeeklyRules(tenant: TenantContext) {
  return prisma.availabilityRule.findMany({
    where: { businessId: tenant.businessId, isActive: true },
    orderBy: { weekday: "asc" },
  });
}

export async function getAvailabilityExceptions(tenant: TenantContext) {
  return prisma.availabilityException.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { date: "asc" },
  });
}

export async function hasAvailabilityRule(tenant: TenantContext): Promise<boolean> {
  const count = await prisma.availabilityRule.count({
    where: { businessId: tenant.businessId, isActive: true },
  });
  return count > 0;
}
