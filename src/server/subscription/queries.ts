/**
 * Read model for the owner's Allura subscription (settings → "מנוי Allura").
 *
 * Server-only.
 */

import { AccountPlan, AccountSubscriptionStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";

export interface SubscriptionOverview {
  /** The plan the app is currently unlocked with (from the user gate flag). */
  plan: AccountPlan | null;
  /** Subscription lifecycle status, when a managed subscription row exists. */
  status: AccountSubscriptionStatus | null;
  priceMinor: number | null;
  currentPeriodEnd: Date | null;
  cardSuffix: string | null;
  cancelledAt: Date | null;
  /**
   * True when there is a real Grow-managed subscription the owner can cancel.
   * False for admins / grandfathered accounts that have `plan` but no billing row.
   */
  isManaged: boolean;
  /** True when the owner can move up to Platinum. */
  canUpgrade: boolean;
}

export async function getSubscriptionOverview(): Promise<SubscriptionOverview> {
  const user = await requireCurrentUser();
  const sub = await prisma.accountSubscription.findUnique({
    where: { userId: user.id },
    select: {
      plan: true,
      status: true,
      priceMinor: true,
      currentPeriodEnd: true,
      cardSuffix: true,
      cancelledAt: true,
    },
  });

  const isManaged =
    !!sub &&
    (sub.status === AccountSubscriptionStatus.active ||
      sub.status === AccountSubscriptionStatus.past_due ||
      sub.status === AccountSubscriptionStatus.cancelled);

  return {
    plan: user.plan,
    status: sub?.status ?? null,
    priceMinor: sub?.priceMinor ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cardSuffix: sub?.cardSuffix ?? null,
    cancelledAt: sub?.cancelledAt ?? null,
    isManaged,
    canUpgrade: user.plan === AccountPlan.premium,
  };
}
