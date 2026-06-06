import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { scopedWhere } from "@/server/db/tenant";

export async function getServices(tenant: TenantContext) {
  return prisma.service.findMany({
    where: { businessId: tenant.businessId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}

export async function getService(tenant: TenantContext, serviceId: string) {
  return prisma.service.findFirst({
    where: scopedWhere(tenant, { id: serviceId }),
  });
}

export async function hasActiveService(tenant: TenantContext): Promise<boolean> {
  const count = await prisma.service.count({
    where: { businessId: tenant.businessId, isActive: true },
  });
  return count > 0;
}
