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
  /**
   * True when access is open (`plan` set) but the monthly billing is awaiting the
   * owner's card re-authorization — e.g. after an admin plan change on a live
   * direct debit (whose amount Grow can't edit in place), or an abandoned self-
   * serve switch. The owner must re-authorize to resume the charge at the new price.
   */
  needsReauth: boolean;
}

export async function getSubscriptionOverview(): Promise<SubscriptionOverview> {
  const user = await requireCurrentUser();
  const sub = await prisma.accountSubscription.findUnique({
    where: { userId: user.id },
    select: {
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

  // Access is granted (plan flag set) but the sub is still `pending` — the
  // recurring charge is not authorized yet and the owner must re-confirm her
  // card. (A brand-new signup is `pending` too, but its plan flag is null until
  // the first payment confirms, so it never trips this.)
  const needsReauth = !!user.plan && sub?.status === AccountSubscriptionStatus.pending;

  return {
    plan: user.plan,
    status: sub?.status ?? null,
    // Fall back to the admin-negotiated price when there is no billing row yet,
    // so the owner never sees the list price where a different amount was agreed.
    priceMinor: sub?.priceMinor ?? user.customPriceMinor ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cardSuffix: sub?.cardSuffix ?? null,
    cancelledAt: sub?.cancelledAt ?? null,
    isManaged,
    needsReauth,
  };
}
