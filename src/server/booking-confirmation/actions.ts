"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";

export async function saveBookingConfirmationSettingsAction(params: {
  requireOptIn: boolean;
  templateName?: string | null;
  templateLanguage?: string | null;
}): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();
  const { requireOptIn, templateName = null, templateLanguage = null } = params;

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "booking_confirmation" } },
      create: {
        businessId: tenant.businessId,
        type: "booking_confirmation",
        enabled: true,
        sendHour: 0,
        thresholdDays: 0,
        cooldownDays: 0,
        requireOptIn,
        templateName,
        templateLanguage,
      },
      update: { requireOptIn, templateName, templateLanguage },
    });
  } catch {
    return { error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: "ההגדרות נשמרו" };
}
