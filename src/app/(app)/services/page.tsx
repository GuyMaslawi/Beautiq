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
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceCard } from "@/components/services/service-card";
import { PageHeader } from "@/components/ui/page-header";
import { PRICING, SERVICES } from "@/lib/constants/he";

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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Page header */}
      <PageHeader
        icon={Sparkles}
        title={SERVICES.pageTitle}
        subtitle="כאן מגדירים את השירותים שהעסק מציע, משך הטיפול והמחיר."
        action={
          <Link href="/services/new">
            <Button size="sm">{SERVICES.addButton}</Button>
          </Link>
        }
      />

      {/* Empty state */}
      {services.length === 0 && (
        <EmptyState
          title={SERVICES.emptyState.title}
          body={SERVICES.emptyState.body}
          cta={SERVICES.emptyState.cta}
          ctaHref="/services/new"
          icon={<Sparkles className="h-7 w-7" style={{ color: "#b86b8c" }} />}
        />
      )}

      {/* Pricing summary strip */}
      {services.length > 0 && (
        <div
          className="grid grid-cols-3 gap-3 rounded-2xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(184,107,140,0.10)" }}>
              <Sparkles className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {summary.activeServicesCount}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{PRICING.summary.servicesCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(184,107,140,0.10)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {summary.avgPricePerHour > 0 ? formatILS(summary.avgPricePerHour) : "—"}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{PRICING.summary.avgPricePerHour}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(184,107,140,0.10)" }}>
              <Banknote className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {summary.servicesWithRangeCount}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>{PRICING.summary.servicesWithRange}</p>
            </div>
          </div>
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
    </div>
  );
}
