import {
  requirePaidUser,
  getCurrentBusiness,
  hasPlatinumAccess,
  getImpersonationState,
} from "@/server/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";

/**
 * Guard + shell for the authenticated area. Every route inside this group
 * requires a signed-in user (unauthenticated visitors go to /login) who has
 * chosen & paid for a plan (unpaid users go to /subscribe). Only then does the
 * full app shell render — including /dashboard when the user has no business
 * yet, so the product feels real from the very first screen.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePaidUser();
  const business = await getCurrentBusiness();
  const hasPlatinum = await hasPlatinumAccess();
  const impersonation = await getImpersonationState();

  return (
    <>
      <AppShell
        userName={user.name ?? user.email}
        businessName={business?.name ?? null}
        isAdmin={user.isAdmin}
        hasPlatinum={hasPlatinum}
        assistantEnabled={hasPlatinum}
      >
        {children}
      </AppShell>
      {impersonation && <ImpersonationBanner ownerName={impersonation.ownerName} />}
    </>
  );
}
