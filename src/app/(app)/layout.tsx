import { requireCurrentUser, getCurrentBusiness } from "@/server/auth/session";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Guard + shell for the authenticated area. Every route inside this group
 * requires a signed-in user (unauthenticated visitors go to /login) and renders
 * inside the full app shell — including /dashboard when the user has no business
 * yet, so the product feels real from the very first screen.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const business = await getCurrentBusiness();

  return (
    <AppShell userName={user.name ?? user.email} businessName={business?.name ?? null}>
      {children}
    </AppShell>
  );
}
