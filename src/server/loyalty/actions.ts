"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { LOYALTY_BOUNDS, LOYALTY_DEFAULTS } from "@/lib/loyalty/constants";
import { LOYALTY } from "@/lib/constants/he";

export interface LoyaltyFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
}

/**
 * Create or update the business's loyalty program configuration. One row per
 * business (upsert on the unique businessId).
 */
export async function saveLoyaltyProgramAction(
  _prevState: LoyaltyFormState,
  formData: FormData,
): Promise<LoyaltyFormState> {
  const tenant = await requireTenant();

  const errors: Partial<Record<string, string>> = {};

  const isActive = String(formData.get("isActive") ?? "") === "on";

  const rawVisits = String(formData.get("visitsRequired") ?? "").trim();
  const visitsRequired = parseInt(rawVisits, 10);
  if (!rawVisits || isNaN(visitsRequired)) {
    errors.visitsRequired = LOYALTY.errors.visitsRequired;
  } else if (
    visitsRequired < LOYALTY_BOUNDS.minVisits ||
    visitsRequired > LOYALTY_BOUNDS.maxVisits
  ) {
    errors.visitsRequired = LOYALTY.errors.visitsRange;
  }

  const rewardDescription = String(formData.get("rewardDescription") ?? "").trim();
  if (!rewardDescription) {
    errors.rewardDescription = LOYALTY.errors.rewardRequired;
  } else if (rewardDescription.length > LOYALTY_BOUNDS.maxRewardLength) {
    errors.rewardDescription = LOYALTY.errors.rewardTooLong;
  }

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.loyaltyProgram.upsert({
      where: { businessId: tenant.businessId },
      create: {
        businessId: tenant.businessId,
        isActive,
        visitsRequired,
        rewardDescription,
      },
      update: { isActive, visitsRequired, rewardDescription },
    });
  } catch {
    return { formError: LOYALTY.errors.generic };
  }

  revalidatePath("/loyalty");
  revalidatePath("/dashboard");
  return { success: LOYALTY.saved };
}

/**
 * Mark an earned reward as given to a client — logs a redemption. Guards against
 * redeeming when the client has no pending reward (re-validated server-side).
 */
export async function redeemLoyaltyRewardAction(
  clientId: string,
): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();
  if (!clientId) return { error: LOYALTY.errors.generic };

  try {
    const [program, client] = await Promise.all([
      prisma.loyaltyProgram.findUnique({ where: { businessId: tenant.businessId } }),
      prisma.client.findFirst({
        where: { id: clientId, businessId: tenant.businessId },
        select: {
          id: true,
          _count: {
            select: {
              bookings: { where: { status: "completed" } },
              loyaltyRedemptions: true,
            },
          },
        },
      }),
    ]);

    if (!program) return { error: LOYALTY.errors.notConfigured };
    if (!client) return { error: LOYALTY.errors.clientNotFound };

    const visitsRequired = Math.max(1, program.visitsRequired);
    const completedVisits = client._count.bookings;
    const redeemedRewards = client._count.loyaltyRedemptions;
    const earnedRewards = Math.floor(completedVisits / visitsRequired);
    const pendingRewards = earnedRewards - redeemedRewards;

    if (pendingRewards <= 0) return { error: LOYALTY.errors.noPendingReward };

    await prisma.loyaltyRedemption.create({
      data: {
        businessId: tenant.businessId,
        clientId: client.id,
        visitsAtRedemption: completedVisits,
      },
    });
  } catch {
    return { error: LOYALTY.errors.generic };
  }

  revalidatePath("/loyalty");
  return { success: LOYALTY.rewardGiven };
}

/** Undo the most recent redemption for a client (in case of a mistake). */
export async function undoLoyaltyRedemptionAction(
  clientId: string,
): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();
  if (!clientId) return { error: LOYALTY.errors.generic };

  try {
    const latest = await prisma.loyaltyRedemption.findFirst({
      where: { businessId: tenant.businessId, clientId },
      orderBy: { redeemedAt: "desc" },
      select: { id: true },
    });
    if (!latest) return { error: LOYALTY.errors.noRedemptionToUndo };

    await prisma.loyaltyRedemption.deleteMany({
      where: { id: latest.id, businessId: tenant.businessId },
    });
  } catch {
    return { error: LOYALTY.errors.generic };
  }

  revalidatePath("/loyalty");
  return { success: LOYALTY.redemptionUndone };
}

export { LOYALTY_DEFAULTS };
