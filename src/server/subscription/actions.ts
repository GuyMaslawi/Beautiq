"use server";

import { AccountPlan } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireCurrentUser } from "@/server/auth/session";

/**
 * Self-serve subscription actions (see CLAUDE.md §13).
 *
 * V1 does NOT integrate a real payment provider — the /subscribe checkout is a
 * manual/mock flow. Activating a plan simply records the owner's choice on their
 * account and stamps the activation time; the app gate then opens the product.
 * When a real provider is added, this action is where the charge is verified
 * before flipping the plan on.
 */

const PLANS: Record<AccountPlan, { priceMonthly: number }> = {
  [AccountPlan.premium]: { priceMonthly: 149 },
  [AccountPlan.platinum]: { priceMonthly: 249 },
};

export interface ActivateResult {
  ok: boolean;
  error?: string;
}

function parsePlan(value: unknown): AccountPlan | null {
  if (value === AccountPlan.premium || value === AccountPlan.platinum) {
    return value;
  }
  return null;
}

/**
 * Activate the chosen plan for the current user. Idempotent: if the user already
 * has a plan we keep it. `planId` is validated server-side — never trust the
 * client to name a plan we don't sell.
 */
export async function activateSubscriptionAction(
  planId: string,
): Promise<ActivateResult> {
  const user = await requireCurrentUser();

  const plan = parsePlan(planId);
  if (!plan || !PLANS[plan]) {
    return { ok: false, error: "בחירת תוכנית לא תקינה. נסי שוב." };
  }

  // Already subscribed — nothing to charge, just proceed.
  if (user.plan) return { ok: true };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan, planActivatedAt: new Date() },
    });
  } catch {
    return { ok: false, error: "אירעה תקלה בהפעלת התוכנית. נסי שוב." };
  }

  return { ok: true };
}

/**
 * Upgrade the current user from Premium to Platinum. Records the new plan and
 * re-stamps the activation time. Idempotent: already-Platinum users just pass.
 * `planId` keeps the signature compatible with MockPaymentForm's `action` prop;
 * the upgrade target is always Platinum, so any other id is rejected.
 */
export async function upgradeToPlatinumAction(
  planId: string,
): Promise<ActivateResult> {
  if (planId !== AccountPlan.platinum) {
    return { ok: false, error: "בחירת תוכנית לא תקינה. נסי שוב." };
  }

  const user = await requireCurrentUser();

  if (user.plan === AccountPlan.platinum) return { ok: true };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: AccountPlan.platinum, planActivatedAt: new Date() },
    });
  } catch {
    return { ok: false, error: "אירעה תקלה בשדרוג התוכנית. נסי שוב." };
  }

  return { ok: true };
}
