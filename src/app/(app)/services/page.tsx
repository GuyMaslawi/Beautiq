import Link from "next/link";
import { Sparkles, TrendingUp, Banknote } from "lucide-react";
import { requireTenant } from "@/server/auth/session";
import { getServices } from "@/server/services/queries";
import { getPricingServices, buildPricingSummary } from "@/server/pricing/queries";
import {
  generateServiceInsights,
  calcBusinessAvgPricePerHour,
  calcBusinessAvgCompletedBookings,
} from "@/lib/pricing/insights";
import { Button } from "@/components/ui/button";
import { ServiceCard } from "@/components/services/service-card";
import { PRICING, SERVICES } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { BeautyPageHero } from "@/components/premium/page-hero";
import { PremiumMetricCard } from "@/components/premium/metric-card";
import { PremiumEmptyState } from "@/components/premium/empty-state";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

export default async function ServicesPage() {
  const tenant = await requireTenant();
  const [services, pricingServices] = await Promise.all([
    getServices(tenant),
    getPricingServices(tenant),
  ]);

  // Pricing health (Phase 3 — absorbed from the retired /pricing page): a
  // business-wide summary plus a per-service "needs a look" badge. Uses the
  // shared pricing insight logic so baselines stay consistent.
  const summary = buildPricingSummary(pricingServices);
  const activePricing = pricingServices.filter((s) => s.isActive);
  const businessAvgPricePerHour = calcBusinessAvgPricePerHour(activePricing);
  const businessAvgCompletedBookings = calcBusinessAvgCompletedBookings(
    activePricing.map((s) => s.completedBookingCount),
  );

  const concernIds = new Set(
    pricingServices
      .filter((s) => {
        if (!s.isActive) return false;
        const insights = generateServiceInsights(
          {
            durationMinutes: s.durationMinutes,
            price: s.price,
            completedBookingCount: s.completedBookingCount,
            marketMinPrice: s.marketMinPrice,
            marketAveragePrice: s.marketAveragePrice,
            marketMaxPrice: s.marketMaxPrice,
          },
          businessAvgPricePerHour,
          businessAvgCompletedBookings,
        );
        return insights.some((i) => i.severity === "warning");
      })
      .map((s) => s.id),
  );

  return (
    <PremiumPageShell tint="champagne" width="wide">
      {/* Page header */}
      <BeautyPageHero
        icon={Sparkles}
        eyebrow="התפריט של העסק"
        title={SERVICES.pageTitle}
        subtitle="כאן מגדירים את השירותים שהעסק מציע, משך הטיפול והמחיר."
        tint="champagne"
        action={
          <Link href="/services/new">
            <Button size="sm">{SERVICES.addButton}</Button>
          </Link>
        }
      />

      {/* Empty state */}
      {services.length === 0 && (
        <PremiumEmptyState
          tint="champagne"
          title={SERVICES.emptyState.title}
          body={SERVICES.emptyState.body}
          cta={SERVICES.emptyState.cta}
          ctaHref="/services/new"
          icon={<Sparkles className="h-7 w-7" />}
        />
      )}

      {/* Pricing summary metric trio (desktop emphasis below the hero ribbon) */}
      {services.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PremiumMetricCard
            tone="brand"
            icon={<Sparkles className="h-4 w-4" />}
            count={summary.activeServicesCount}
            label={PRICING.summary.servicesCount}
          />
          <PremiumMetricCard
            tone="gold"
            icon={<TrendingUp className="h-4 w-4" />}
            count={summary.avgPricePerHour > 0 ? formatILS(summary.avgPricePerHour) : "—"}
            label={PRICING.summary.avgPricePerHour}
          />
          <PremiumMetricCard
            tone="success"
            icon={<Banknote className="h-4 w-4" />}
            count={summary.servicesWithRangeCount}
            label={PRICING.summary.servicesWithRange}
          />
        </div>
      )}

      {/* Service list */}
      {services.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              pricingBadge={concernIds.has(service.id) ? "לבדיקת תמחור" : undefined}
            />
          ))}
        </div>
      )}
    </PremiumPageShell>
  );
}
