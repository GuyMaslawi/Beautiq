import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

export interface BusinessSettingsData {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  city: string | null;
  area: string | null;
  description: string | null;
  addressNote: string | null;
}

export interface BusinessCategoryData {
  id: string;
  key: string;
  nameHe: string;
}

export async function getBusinessSettings(
  tenant: TenantContext,
): Promise<BusinessSettingsData | null> {
  return prisma.business.findUnique({
    where: { id: tenant.businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      city: true,
      area: true,
      description: true,
      addressNote: true,
    },
  });
}

export async function getAllBusinessCategories(): Promise<BusinessCategoryData[]> {
  return prisma.businessCategory.findMany({
    select: { id: true, key: true, nameHe: true },
    orderBy: { key: "asc" },
  });
}

export async function getSelectedCategoryIds(
  tenant: TenantContext,
): Promise<string[]> {
  const rows = await prisma.businessCategoryOnBusiness.findMany({
    where: { businessId: tenant.businessId },
    select: { categoryId: true },
  });
  return rows.map((r) => r.categoryId);
}
