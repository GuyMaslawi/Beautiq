/**
 * Read model for /admin/accounts — every Allura ACCOUNT (owner user), including
 * the ones that own nothing yet.
 *
 * /admin/businesses lists businesses, so an owner who signed up and stopped at
 * the paywall is invisible there: she cannot create a business until she has
 * access. That is exactly the account a launch-day free trial has to reach, so
 * this view is keyed on the user, not the tenant.
 *
 * Server-only, platform-admin only (the page guards with requirePlatformAdmin).
 */

import { prisma } from "@/server/db/prisma";

/** Which slice of the account list to show. */
export type AccountFilter = "all" | "waiting" | "trial" | "paid";

export const ACCOUNT_FILTERS: AccountFilter[] = ["all", "waiting", "trial", "paid"];

export interface AdminAccountRow {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  /** Raw plan flag — may be set with a past expiry (= lapsed). */
  plan: string | null;
  planExpiresAt: Date | null;
  suspendedUntil: Date | null;
  customPriceMinor: number | null;
  subscriptionStatus: string | null;
  business: { id: string; name: string; slug: string } | null;
  /** True when access is open right now (plan set and not expired). */
  hasAccess: boolean;
  /** True when the open access is a comped/time-limited grant. */
  onTrial: boolean;
}

export interface AdminAccountsResult {
  rows: AdminAccountRow[];
  counts: { all: number; waiting: number; trial: number; paid: number };
}

export async function getAdminAccounts(opts: {
  q?: string;
  filter?: AccountFilter;
}): Promise<AdminAccountsResult> {
  const q = opts.q?.trim() ?? "";
  const filter: AccountFilter = ACCOUNT_FILTERS.includes(opts.filter as AccountFilter)
    ? (opts.filter as AccountFilter)
    : "all";
  const now = new Date();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      createdAt: true,
      plan: true,
      planExpiresAt: true,
      suspendedUntil: true,
      customPriceMinor: true,
      subscription: { select: { status: true } },
      memberships: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { business: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const all: AdminAccountRow[] = users.map((u) => {
    const expired = !!u.planExpiresAt && u.planExpiresAt.getTime() <= now.getTime();
    const hasAccess = !!u.plan && !expired;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: u.isAdmin,
      createdAt: u.createdAt,
      plan: u.plan,
      planExpiresAt: u.planExpiresAt,
      suspendedUntil: u.suspendedUntil,
      customPriceMinor: u.customPriceMinor,
      subscriptionStatus: u.subscription?.status ?? null,
      business: u.memberships[0]?.business ?? null,
      hasAccess,
      onTrial: hasAccess && !!u.planExpiresAt,
    };
  });

  // "waiting" = signed up, no access right now — the queue to hand trials to.
  const isWaiting = (r: AdminAccountRow) => !r.hasAccess && !r.isAdmin;
  const isPaid = (r: AdminAccountRow) => r.hasAccess && !r.onTrial;

  const counts = {
    all: all.length,
    waiting: all.filter(isWaiting).length,
    trial: all.filter((r) => r.onTrial).length,
    paid: all.filter(isPaid).length,
  };

  const rows =
    filter === "waiting"
      ? all.filter(isWaiting)
      : filter === "trial"
        ? all.filter((r) => r.onTrial)
        : filter === "paid"
          ? all.filter(isPaid)
          : all;

  return { rows, counts };
}
