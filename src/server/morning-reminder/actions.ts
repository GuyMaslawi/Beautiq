"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";

export async function toggleMorningReminderAction(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const tenant = await requireTenant();

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "morning_reminder" } },
      create: {
        businessId: tenant.businessId,
        type: "morning_reminder",
        enabled,
        sendHour: 8,
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

export interface MorningReminderSettingsState {
  success?: string;
  error?: string;
}

export async function saveMorningReminderSettingsAction(
  _prev: MorningReminderSettingsState,
  formData: FormData,
): Promise<MorningReminderSettingsState> {
  const tenant = await requireTenant();

  const sendHour = parseInt(String(formData.get("sendHour") ?? "8"), 10);
  const messageTemplate = String(formData.get("messageTemplate") ?? "").trim() || null;

  if (isNaN(sendHour) || sendHour < 6 || sendHour > 12) {
    return { error: "שעת שליחה חייבת להיות בין 6 ל-12" };
  }

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "morning_reminder" } },
      create: {
        businessId: tenant.businessId,
        type: "morning_reminder",
        enabled: false,
        sendHour,
        messageTemplate,
        thresholdDays: 0,
        cooldownDays: 0,
        requireOptIn: false,
      },
      update: { sendHour, messageTemplate },
    });
  } catch {
    return { error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: "ההגדרות נשמרו" };
}

export async function saveMorningReminderTimingAction(params: {
  sendHour: number;
  thresholdDays: number;
  messageTemplate: string | null;
  requireOptIn?: boolean;
}): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();
  const { sendHour, thresholdDays, messageTemplate, requireOptIn = false } = params;

  try {
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: tenant.businessId, type: "morning_reminder" } },
      create: {
        businessId: tenant.businessId,
        type: "morning_reminder",
        enabled: false,
        sendHour,
        thresholdDays,
        messageTemplate,
        cooldownDays: 0,
        requireOptIn,
      },
      update: { sendHour, thresholdDays, messageTemplate, requireOptIn },
    });
  } catch {
    return { error: "שגיאה בשמירת ההגדרות" };
  }

  revalidatePath("/automations");
  return { success: "ההגדרות נשמרו" };
}
