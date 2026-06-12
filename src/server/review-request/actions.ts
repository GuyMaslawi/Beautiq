"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";

export async function toggleReviewRequestAction(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "review_request" } },
      create: {
        businessId: tenant.businessId,
        type: "review_request",
        enabled,
        sendHour: 10,
        thresholdDays: 0,
        cooldownDays: 0,
        requireOptIn: false,
      },
      update: { enabled },
    });
  } catch {
    return { success: false, error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: true };
}

export interface ReviewRequestSettingsState {
  success?: string;
  error?: string;
}

export async function saveReviewRequestSettingsAction(
  _prev: ReviewRequestSettingsState,
  formData: FormData,
): Promise<ReviewRequestSettingsState> {
  const tenant = await requireTenant();

  const messageTemplate = String(formData.get("messageTemplate") ?? "").trim() || null;
  const reviewLink = String(formData.get("reviewLink") ?? "").trim() || null;

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "review_request" } },
      create: {
        businessId: tenant.businessId,
        type: "review_request",
        enabled: false,
        sendHour: 10,
        messageTemplate,
        offerValue: reviewLink,
        thresholdDays: 0,
        cooldownDays: 0,
        requireOptIn: false,
      },
      update: { messageTemplate, offerValue: reviewLink },
    });
  } catch {
    return { error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: "ההגדרות נשמרו" };
}

export async function saveReviewRequestTimingAction(params: {
  hoursAfter: number;
  messageTemplate: string | null;
  reviewLink: string | null;
  requireOptIn?: boolean;
}): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();
  const { hoursAfter, messageTemplate, reviewLink, requireOptIn = false } = params;

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "review_request" } },
      create: {
        businessId: tenant.businessId,
        type: "review_request",
        enabled: false,
        sendHour: hoursAfter,
        messageTemplate,
        offerValue: reviewLink,
        thresholdDays: 0,
        cooldownDays: 0,
        requireOptIn,
      },
      update: { sendHour: hoursAfter, messageTemplate, offerValue: reviewLink, requireOptIn },
    });
  } catch {
    return { error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: "ההגדרות נשמרו" };
}
