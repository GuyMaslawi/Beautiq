import { redirect } from "next/navigation";
import type { Business } from "@prisma/client";
import { auth } from "@/server/auth/config";
import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

/**
 * Server-side session & tenant resolution (see CLAUDE.md §9–10).
 *
 * The golden rule: `businessId` is ALWAYS derived from the authenticated user
 * through BusinessUser — never taken from client input. Protected routes call
 * the `require*` helpers, which redirect unauthenticated users to /login.
 *
 * The app shell lives at /dashboard: a signed-in user without a business still
 * sees the full shell there (with a setup card), so business-scoped pages send
 * users back to /dashboard rather than into a separate onboarding wizard.
 *
 * V1 assumes one business per user: we resolve the user's first (owned)
 * membership. The data model supports more, but the app uses this one.
 */

/** Public-safe shape of the signed-in user — never includes passwordHash. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/** The current user, or null if unauthenticated. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

/** The current user, or redirect to /login. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The current user's business (first/owned membership), or null. The dashboard
 * uses this directly to decide between the "create your business" setup card and
 * the setup checklist — without redirecting.
 */
export async function getCurrentBusiness(): Promise<Business | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const membership = await prisma.businessUser.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { business: true },
  });
  return membership?.business ?? null;
}

/**
 * The current user's business, or a redirect: to /login if unauthenticated, or
 * to /dashboard if the user has no business yet (where the setup card lives).
 * This is the resolver every business-scoped route should use. The dashboard
 * itself must NOT use it — it handles the "no business" state inline.
 */
export async function requireCurrentBusiness(): Promise<Business> {
  await requireCurrentUser();
  const business = await getCurrentBusiness();
  if (!business) redirect("/dashboard");
  return business;
}

/** Convenience: the tenant scope for the current business. */
export async function requireTenant(): Promise<TenantContext> {
  const business = await requireCurrentBusiness();
  return { businessId: business.id };
}
