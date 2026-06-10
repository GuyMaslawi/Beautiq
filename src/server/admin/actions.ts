"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import type { SubscriptionPlan, SubscriptionStatus, DiscountType } from "@prisma/client";

export interface UpdateSubscriptionInput {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthlyPrice: string;
  discountType: DiscountType;
  discountValue: string;
  discountNote: string;
  trialStartedAt: string;
  trialEndsAt: string;
  adminNotes: string;
}

export interface UpdateSubscriptionResult {
  success: boolean;
  error?: string;
}

export async function updateBusinessSubscription(
  businessId: string,
  data: UpdateSubscriptionInput,
): Promise<UpdateSubscriptionResult> {
  await requirePlatformAdmin();

  const monthlyPrice = parseFloat(data.monthlyPrice);
  if (isNaN(monthlyPrice) || monthlyPrice < 0) {
    return { success: false, error: "מחיר חודשי לא תקין" };
  }

  const discountValue = data.discountValue ? parseFloat(data.discountValue) : null;
  if (data.discountType !== "none" && discountValue !== null && isNaN(discountValue)) {
    return { success: false, error: "ערך הנחה לא תקין" };
  }

  const trialStartedAt = data.trialStartedAt ? new Date(data.trialStartedAt) : null;
  const trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;

  const payload = {
    plan: data.plan,
    status: data.status,
    monthlyPrice,
    discountType: data.discountType,
    discountValue,
    discountNote: data.discountNote || null,
    trialStartedAt,
    trialEndsAt,
    adminNotes: data.adminNotes || null,
    // Set suspendedAt / cancelledAt timestamps when status transitions
    suspendedAt:
      data.status === "suspended" ? new Date() : null,
    cancelledAt:
      data.status === "cancelled" ? new Date() : null,
  };

  await prisma.businessSubscription.upsert({
    where: { businessId },
    create: { businessId, ...payload },
    update: payload,
  });

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  revalidatePath("/admin");

  return { success: true };
}
