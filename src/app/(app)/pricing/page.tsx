import Link from "next/link";
import { TrendingUp, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
            requiresDeposit: service.requiresDeposit,
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
    <div className="mx-auto w-full max-w-2xl space-y-6" dir="rtl">
      {/* Page header */}
      <PageHeader
        icon={TrendingUp}
        title={PRICING.pageTitle}
        subtitle="בדיקה מהירה של מחיר, זמן טיפול, מקדמה ורווחיות השירותים."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {summary.activeServicesCount}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {PRICING.summary.servicesCount}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#b86b8c" }}>
            {summary.avgPricePerHour > 0 ? formatILS(summary.avgPricePerHour) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {PRICING.summary.avgPricePerHour}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">
            {summary.servicesWithRangeCount}
          </p>
          <p className="text-muted mt-1 text-xs leading-tight">
            {PRICING.summary.servicesWithRange}
          </p>
        </Card>
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
    </div>
  );
}
