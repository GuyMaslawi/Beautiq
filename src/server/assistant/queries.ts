import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";
import { getGuidanceData } from "@/server/guidance/queries";
import { generateGuidanceItems } from "@/lib/guidance/rules";
import { getAtRiskClients } from "@/server/at-risk/queries";
import { getEmptySlotsData } from "@/server/empty-slots/queries";
import { getLoyaltyProgram, getLoyaltyEligibleCount } from "@/server/loyalty/queries";
import type { AssistantContext } from "@/lib/assistant/engine";

/**
 * Aggregates every rule-based data source into a single serializable context the
 * assistant engine answers from. Everything is business-scoped via `tenant`.
 */
export async function getAssistantContext(
  tenant: TenantContext,
  businessName: string,
): Promise<AssistantContext> {
  const [
    forecast,
    guidanceData,
    atRiskClients,
    emptySlots,
    loyaltyConfig,
    loyaltyEligible,
    totalClients,
  ] = await Promise.all([
    getRevenueForecastData(tenant),
    getGuidanceData(tenant),
    getAtRiskClients(tenant),
    getEmptySlotsData(tenant),
    getLoyaltyProgram(tenant),
    getLoyaltyEligibleCount(tenant),
    prisma.client.count({ where: { businessId: tenant.businessId } }),
  ]);

  const guidanceItems = generateGuidanceItems(guidanceData, emptySlots.slots.length);

  return {
    businessName,

    monthRevenue: forecast.completedRevenue,
    expectedRevenue: forecast.expectedRevenue,
    monthlyTarget: forecast.monthlyTarget,
    gapToTarget: forecast.gapToTarget,
    isOnTrack: forecast.isOnTrack,
    targetReliable: forecast.targetReliable,
    avgBookingValue: forecast.avgBookingValue,
    lostRevenue: forecast.lostRevenue,
    completedBookingsCount: forecast.completedBookingsCount,

    topServices: forecast.topServices.map((s) => ({
      name: s.name,
      revenue: s.revenue,
      bookingsCount: s.bookingsCount,
      avgPrice: s.avgPrice,
    })),
    activeServices: guidanceData.activeServicesCount,

    totalClients,
    atRiskCount: atRiskClients.length,
    atRiskTop: atRiskClients.slice(0, 3).map((c) => ({
      fullName: c.fullName,
      daysSinceLastVisit: c.daysSinceLastVisit,
    })),

    bookingsToday: guidanceData.todayBookingsCount,
    upcomingBookingsCount: guidanceData.upcomingBookingsCount,
    emptySlotsCount: emptySlots.slots.length,

    pricingConcernCount: guidanceData.pricingConcernCount,

    loyaltyConfigured: loyaltyConfig.configured && loyaltyConfig.isActive,
    loyaltyEligibleCount: loyaltyEligible,

    guidance: guidanceItems.map((g) => ({
      id: g.id,
      title: g.title,
      actionLabel: g.actionLabel,
      href: g.href,
    })),
  };
}
