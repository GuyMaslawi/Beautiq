import { redirect } from "next/navigation";
import { AccountPlan } from "@prisma/client";
import type { Business } from "@prisma/client";
import { auth } from "@/server/auth/config";
import { prisma } from "@/server/db/prisma";
import { touchLastSeen } from "@/server/activity/last-seen";
import { readImpersonationCookie } from "@/server/admin/impersonation";
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
  isAdmin: boolean;
  /**
   * The EFFECTIVE self-serve plan — null until paid, and also null once a
   * time-limited (comped) plan's `planExpiresAt` has passed.
   */
  plan: AccountPlan | null;
  planActivatedAt: Date | null;
  /** When the account is suspended until (future = currently suspended). */
  suspendedUntil: Date | null;
  /** True when a platform admin is currently viewing the app AS this owner. */
  impersonating?: boolean;
}

/** The current user, or null if unauthenticated. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const realUserId = session?.user?.id;
  if (!realUserId) return null;

  // Impersonation: honor the signed cookie ONLY when the live session user is a
  // genuine admin — then resolve the target owner instead. This can never
  // elevate a non-admin (the cookie is HMAC-signed and the admin check is
  // re-verified here on every request).
  let effectiveUserId = realUserId;
  let impersonating = false;
  const imp = await readImpersonationCookie();
  if (imp && imp.adminId === realUserId) {
    const realUser = await prisma.user.findUnique({
      where: { id: realUserId },
      select: { isAdmin: true },
    });
    if (realUser?.isAdmin) {
      effectiveUserId = imp.targetUserId;
      impersonating = true;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      plan: true,
      planActivatedAt: true,
      planExpiresAt: true,
      suspendedUntil: true,
      lastSeenAt: true,
    },
  });
  if (!user) return null;

  // Heartbeat only for real sessions — never pollute an owner's "last seen"
  // while an admin is impersonating them.
  if (!impersonating) void touchLastSeen(user.id, user.lastSeenAt);

  // A comped/time-limited plan lapses the instant planExpiresAt passes — every
  // consumer (paywall, hasPlatinumAccess, feature gates) then sees plan = null.
  const now = Date.now();
  const effectivePlan =
    user.plan && (!user.planExpiresAt || user.planExpiresAt.getTime() > now)
      ? user.plan
      : null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    plan: effectivePlan,
    planActivatedAt: user.planActivatedAt,
    suspendedUntil: user.suspendedUntil,
    impersonating,
  };
}

/**
 * The current user, or redirect: to /login if unauthenticated, or to /subscribe
 * if they have not chosen & paid for a plan yet. Admins bypass the paywall.
 * This is the gate the authenticated app shell uses before opening the product.
 */
export async function requirePaidUser(): Promise<CurrentUser> {
  const user = await requireCurrentUser();

  // Temporary admin suspension takes precedence over everything (except admins /
  // an impersonating admin): a suspended account cannot re-enter by paying.
  if (
    !user.isAdmin &&
    !user.impersonating &&
    user.suspendedUntil &&
    user.suspendedUntil.getTime() > Date.now()
  ) {
    redirect("/suspended");
  }

  // The paywall: `plan` is set only once a payment is CONFIRMED server-side
  // (the Grow webhook / return route), and cleared when a subscription lapses —
  // so this gate opens only for a genuinely paid, active account. Admins bypass,
  // and an admin impersonating an (unpaid) owner is never trapped at /subscribe.
  if (!user.plan && !user.isAdmin && !user.impersonating) redirect("/subscribe");
  return user;
}

/** The current user, or redirect to /login. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * True when the current user may use Platinum-tier features. Admins always pass;
 * otherwise the user must be on the `platinum` plan. Used to gate the advanced
 * growth tools (revenue forecast, at-risk clients, automated campaigns) — see
 * [[project_subscribe_paywall]].
 */
export async function hasPlatinumAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.isAdmin || user.plan === AccountPlan.platinum;
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

export interface ImpersonationState {
  ownerName: string;
  businessId: string | null;
}

/**
 * When the live session belongs to an admin who is impersonating an owner,
 * returns who they're viewing as (for the banner) — otherwise null. Verifies the
 * signed cookie AND that the real session user is a genuine admin.
 */
export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const session = await auth();
  const realUserId = session?.user?.id;
  if (!realUserId) return null;

  const imp = await readImpersonationCookie();
  if (!imp || imp.adminId !== realUserId) return null;

  const realUser = await prisma.user.findUnique({
    where: { id: realUserId },
    select: { isAdmin: true },
  });
  if (!realUser?.isAdmin) return null;

  const target = await prisma.user.findUnique({
    where: { id: imp.targetUserId },
    select: { name: true, email: true },
  });

  return {
    ownerName: target?.name ?? target?.email ?? "בעלת העסק",
    businessId: imp.businessId,
  };
}
