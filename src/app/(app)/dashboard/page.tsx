import { getCurrentBusiness } from "@/server/auth/session";
import { getDashboardData } from "@/server/dashboard/queries";
import { getGuidanceData } from "@/server/guidance/queries";
import { getEmptySlotsData } from "@/server/empty-slots/queries";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";
import { getReputationSummary } from "@/server/reputation/queries";
import { getRemindersDueCount, getRecentAutomationRuns } from "@/server/automations/queries";
import { getOwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import { getLateCancellationsThisWeek } from "@/server/bookings/queries";
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

  const [
    dashboardData,
    guidanceQueryData,
    emptySlotsData,
    forecast,
    reputationSummary,
    remindersDueCount,
    recentRuns,
    whatsappStatus,
    lateCancellationsCount,
  ] = await Promise.all([
    getDashboardData(tenant, {
      phone: business.phone,
      description: business.description,
      city: business.city,
      area: business.area,
      addressNote: business.addressNote,
    }),
    getGuidanceData(tenant),
    getEmptySlotsData(tenant),
    getRevenueForecastData(tenant),
    getReputationSummary(tenant),
    getRemindersDueCount(tenant),
    getRecentAutomationRuns(tenant, 3),
    getOwnerWhatsAppStatus(business.id),
    getLateCancellationsThisWeek(tenant),
  ]);

  const guidanceItems = generateGuidanceItems(
    guidanceQueryData,
    emptySlotsData.slots.length,
  );

  return (
    <SetupChecklist
      businessName={business.name}
      metrics={dashboardData.metrics}
      setup={dashboardData.setup}
      todayBookings={dashboardData.todayBookings}
      upcomingBookings={dashboardData.upcomingBookings}
      pendingApprovalCount={dashboardData.pendingApprovalCount}
      guidanceItems={guidanceItems}
      emptySlots={emptySlotsData.slots}
      suggestedClients={emptySlotsData.suggestedClients}
      atRiskCount={guidanceQueryData.lostClientsCount}
      remindersDueCount={remindersDueCount}
      lateCancellationsCount={lateCancellationsCount}
      forecast={forecast}
      reviewReadyCount={reputationSummary.recentCompletedCount}
      recentRuns={recentRuns}
      whatsappLabel={whatsappStatus.ownerSetupLabel}
      whatsappReady={whatsappStatus.ownerSetupState === "ready"}
      whatsappConnected={whatsappStatus.readiness.connectionReady}
    />
  );
}
