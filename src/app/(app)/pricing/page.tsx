import Link from "next/link";
import { TrendingUp, Sparkles, Banknote } from "lucide-react";
import { PremiumPageShell, BeautyPageHero } from "@/components/premium";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getPricingServices, buildPricingSummary } from "@/server/pricing/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PricingServiceCard } from "@/components/pricing/pricing-service-card";
import {
  generateServiceInsights,
  calcBusinessAvgPricePerHour,
  calcBusinessAvgCompletedBookings,
} from "@/lib/pricing/insights";
import { PRICING } from "@/lib/constants/he";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

export default async function PricingPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const services = await getPricingServices(tenant);
  const summary = buildPricingSummary(services);

  const activeServices = services.filter((s) => s.isActive);

  const businessAvgPricePerHour = calcBusinessAvgPricePerHour(activeServices);
  const businessAvgCompletedBookings = calcBusinessAvgCompletedBookings(
    activeServices.map((s) => s.completedBookingCount),
  );

  const servicesWithInsights = services.map((service) => ({
    service,
    insights: service.isActive
      ? generateServiceInsights(
          {
            durationMinutes: service.durationMinutes,
            price: service.price,
            completedBookingCount: service.completedBookingCount,
            marketMinPrice: service.marketMinPrice,
            marketAveragePrice: service.marketAveragePrice,
            marketMaxPrice: service.marketMaxPrice,
          },
          businessAvgPricePerHour,
          businessAvgCompletedBookings,
        )
      : [],
  }));

  return (
    <PremiumPageShell tint="champagne" width="default">
      {/* Page header */}
      <BeautyPageHero
        icon={TrendingUp}
        eyebrow="תמחור ורווחיות"
        title={PRICING.pageTitle}
        subtitle="בדיקה מהירה של מחיר, זמן טיפול ורווחיות השירותים."
        tint="champagne"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* שירותים פעילים */}
        <div
          className="rounded-2xl px-5 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.activeServicesCount > 0 ? "rgba(247,238,243,0.85)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.activeServicesCount > 0 ? "rgba(184,107,140,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.activeServicesCount > 0 ? "rgba(184,107,140,0.13)" : "rgba(184,107,140,0.08)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: summary.activeServicesCount > 0 ? "#b86b8c" : "#2b2530" }}>
            {summary.activeServicesCount}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {PRICING.summary.servicesCount}
          </p>
        </div>

        {/* מחיר ממוצע לשעה */}
        <div
          className="rounded-2xl px-5 py-4 transition-shadow hover:shadow-md"
          style={{
            background: summary.avgPricePerHour > 0 ? "rgba(247,238,243,0.85)" : "rgba(255,255,255,0.90)",
            border: `1px solid ${summary.avgPricePerHour > 0 ? "rgba(184,107,140,0.22)" : "var(--border)"}`,
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: summary.avgPricePerHour > 0 ? "rgba(184,107,140,0.13)" : "rgba(184,107,140,0.08)" }}
          >
            <TrendingUp className="h-4 w-4" style={{ color: "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#b86b8c" }}>
            {summary.avgPricePerHour > 0 ? formatILS(summary.avgPricePerHour) : "—"}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {PRICING.summary.avgPricePerHour}
          </p>
        </div>

        {/* שירותים עם טווח מחיר */}
        <div
          className="rounded-2xl px-5 py-4 transition-shadow hover:shadow-md"
          style={{
            background: "rgba(255,255,255,0.90)",
            border: "1px solid var(--border)",
            boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
          }}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "rgba(184,107,140,0.08)" }}
          >
            <Banknote className="h-4 w-4" style={{ color: "#b86b8c" }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#2b2530" }}>
            {summary.servicesWithRangeCount}
          </p>
          <p className="mt-1 text-xs font-medium leading-tight" style={{ color: "#8a8190" }}>
            {PRICING.summary.servicesWithRange}
          </p>
        </div>
      </div>

      {/* Service list or empty state */}
      {services.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,120,152,0.12) 0%, rgba(184,107,140,0.08) 100%)",
              }}
            >
              <Sparkles className="h-6 w-6" style={{ color: "#b86b8c" }} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">
              {PRICING.emptyState.title}
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              {PRICING.emptyState.body}
            </p>
          </div>
          <Link href={PRICING.emptyState.ctaHref}>
            <Button variant="secondary" size="sm">
              {PRICING.emptyState.cta}
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {servicesWithInsights.map(({ service, insights }) => (
            <PricingServiceCard
              key={service.id}
              service={service}
              insights={insights}
            />
          ))}
        </div>
      )}
    </PremiumPageShell>
  );
}
