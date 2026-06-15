import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { calcPricePerHour, calcBusinessAvgPricePerHour } from "@/lib/pricing/insights";

export interface PricingServiceData {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  pricePerHour: number;
  isActive: boolean;
  completedBookingCount: number;
  marketMinPrice: number | null;
  marketAveragePrice: number | null;
  marketMaxPrice: number | null;
}

export interface PricingSummary {
  activeServicesCount: number;
  avgPricePerHour: number;
  servicesWithRangeCount: number;
}

export async function getPricingServices(
  tenant: TenantContext,
): Promise<PricingServiceData[]> {
  const services = await prisma.service.findMany({
    where: { businessId: tenant.businessId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      price: true,
      durationMinutes: true,
      isActive: true,
      marketMinPrice: true,
      marketAveragePrice: true,
      marketMaxPrice: true,
      _count: {
        select: {
          bookings: {
            where: {
              businessId: tenant.businessId,
              status: "completed",
            },
          },
        },
      },
    },
  });

  return services.map((s) => {
    const price = Number(s.price);
    return {
      id: s.id,
      name: s.name,
      price,
      durationMinutes: s.durationMinutes,
      pricePerHour: calcPricePerHour(price, s.durationMinutes),
      isActive: s.isActive,
      completedBookingCount: s._count.bookings,
      marketMinPrice: s.marketMinPrice ? Number(s.marketMinPrice) : null,
      marketAveragePrice: s.marketAveragePrice ? Number(s.marketAveragePrice) : null,
      marketMaxPrice: s.marketMaxPrice ? Number(s.marketMaxPrice) : null,
    };
  });
}

export function buildPricingSummary(services: PricingServiceData[]): PricingSummary {
  const active = services.filter((s) => s.isActive);
  const avgPricePerHour = calcBusinessAvgPricePerHour(active);
  const withRange = services.filter(
    (s) => s.marketMinPrice !== null || s.marketMaxPrice !== null,
  );
  return {
    activeServicesCount: active.length,
    avgPricePerHour,
    servicesWithRangeCount: withRange.length,
  };
}

export async function getPricingConcernCount(tenant: TenantContext): Promise<number> {
  // Lightweight check for the guidance rule: count services that have a price
  // below their manually defined market min price.
  // To avoid a full table scan, we only fetch services that have a marketMinPrice set.
  const rangeServices = await prisma.service.findMany({
    where: {
      businessId: tenant.businessId,
      isActive: true,
      marketMinPrice: { not: null },
    },
    select: { price: true, marketMinPrice: true },
  });

  const belowRangeCount = rangeServices.filter(
    (s) => s.marketMinPrice !== null && Number(s.price) < Number(s.marketMinPrice),
  ).length;

  return belowRangeCount;
}
