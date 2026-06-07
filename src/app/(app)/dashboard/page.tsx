import { getCurrentBusiness } from "@/server/auth/session";
import { getPendingDepositBookings } from "@/server/bookings/queries";
import { getDashboardData } from "@/server/dashboard/queries";
import { getGuidanceData } from "@/server/guidance/queries";
import { getEmptySlotsData } from "@/server/empty-slots/queries";
import { generateGuidanceItems } from "@/lib/guidance/rules";
import { BusinessSetupCard } from "@/components/dashboard/business-setup-card";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";

/**
 * The dashboard is the home of the app shell. The (app) layout already requires
 * a signed-in user, so here we only branch on business state — without
 * redirecting:
 *   State A — no business yet → the in-app business setup card.
 *   State B — business exists → the full guided dashboard with real CRM data.
 */
export default async function DashboardPage() {
  const business = await getCurrentBusiness();

  if (!business) {
    return <BusinessSetupCard />;
  }

  const tenant = { businessId: business.id };

  const [dashboardData, rawDeposits, guidanceQueryData, emptySlotsData] =
    await Promise.all([
      getDashboardData(tenant, {
        phone: business.phone,
        description: business.description,
        city: business.city,
        area: business.area,
        addressNote: business.addressNote,
      }),
      getPendingDepositBookings(tenant),
      getGuidanceData(tenant),
      getEmptySlotsData(tenant),
    ]);

  const pendingDeposits = rawDeposits.map((b) => ({
    id: b.id,
    startTimeISO: b.startTime.toISOString(),
    depositAmount: b.depositAmountSnapshot ? Number(b.depositAmountSnapshot) : null,
    clientName: b.client.fullName,
    serviceName: b.service.name,
  }));

  const guidanceItems = generateGuidanceItems(
    guidanceQueryData,
    emptySlotsData.slots.length,
  );

  return (
    <SetupChecklist
      businessName={business.name}
      metrics={dashboardData.metrics}
      setup={dashboardData.setup}
      upcomingBookings={dashboardData.upcomingBookings}
      pendingDeposits={pendingDeposits}
      guidanceItems={guidanceItems}
      emptySlots={emptySlotsData.slots}
      suggestedClients={emptySlotsData.suggestedClients}
    />
  );
}
