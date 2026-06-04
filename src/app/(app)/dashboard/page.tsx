import { getCurrentBusiness } from "@/server/auth/session";
import { BusinessSetupCard } from "@/components/dashboard/business-setup-card";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";

/**
 * The dashboard is the home of the app shell. The (app) layout already requires
 * a signed-in user, so here we only branch on business state — without
 * redirecting:
 *   State A — no business yet → the in-app business setup card.
 *   State B — business exists → the guided setup checklist.
 */
export default async function DashboardPage() {
  const business = await getCurrentBusiness();
  return business ? <SetupChecklist /> : <BusinessSetupCard />;
}
