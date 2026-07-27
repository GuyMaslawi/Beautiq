import { notFound } from "next/navigation";
import { requireTenant } from "@/server/auth/session";
import { getService } from "@/server/services/queries";
import { getPricingServices } from "@/server/pricing/queries";
import { updateServiceAction } from "@/server/services/actions";
import { ServiceForm } from "@/components/services/service-form";
import { ServicePricingHealth } from "@/components/services/service-pricing-health";
import { ServicePageHeader } from "@/components/services/service-page-header";
import {
  generateServiceInsights,
  calcBusinessAvgPricePerHour,
  calcBusinessAvgCompletedBookings,
} from "@/lib/pricing/insights";
import { SERVICES } from "@/lib/constants/he";
import { PremiumPageShell } from "@/components/premium/page-shell";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const tenant = await requireTenant();
  const { serviceId } = await params;

  const service = await getService(tenant, serviceId);
  if (!service) notFound();

  // Pricing health for this service — reuse the shared pricing insight logic so
  // the business-wide baselines stay consistent with the (retired) pricing page.
  const pricingServices = await getPricingServices(tenant);
  const activePricing = pricingServices.filter((s) => s.isActive);
  const businessAvgPricePerHour = calcBusinessAvgPricePerHour(activePricing);
  const businessAvgCompletedBookings = calcBusinessAvgCompletedBookings(
    activePricing.map((s) => s.completedBookingCount),
  );
  const pricingData = pricingServices.find((s) => s.id === service.id) ?? null;
  const pricingInsights =
    pricingData && pricingData.isActive
      ? generateServiceInsights(
          {
            durationMinutes: pricingData.durationMinutes,
            price: pricingData.price,
            completedBookingCount: pricingData.completedBookingCount,
            marketMinPrice: pricingData.marketMinPrice,
            marketAveragePrice: pricingData.marketAveragePrice,
            marketMaxPrice: pricingData.marketMaxPrice,
          },
          businessAvgPricePerHour,
          businessAvgCompletedBookings,
        )
      : [];

  const boundAction = updateServiceAction.bind(null, service.id);

  const initialValues = {
    name: service.name,
    description: service.description ?? undefined,
    durationMinutes: service.durationMinutes,
    price: service.price.toString(),
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    categoryKey: service.categoryKey ?? undefined,
    isActive: service.isActive,
  };

  return (
    <PremiumPageShell tint="champagne" width="default">
      {/* Breadcrumb + editorial header band */}
      <ServicePageHeader
        eyebrow="עריכת שירות"
        title={SERVICES.form.editTitle}
        subtitle={`${service.name} — עדכוני פרטים, מחיר וזמינות השירות`}
      />

      <ServiceForm
        action={boundAction}
        initialValues={initialValues}
        isEdit
        pricingHealth={
          pricingData ? (
            <ServicePricingHealth
              service={pricingData}
              insights={pricingInsights}
              businessAvgPricePerHour={businessAvgPricePerHour}
            />
          ) : undefined
        }
      />
    </PremiumPageShell>
  );
}
