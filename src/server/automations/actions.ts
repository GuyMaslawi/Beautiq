"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";

// ---------------------------------------------------------------------------
// Save reminder settings (stored in Business.settings JSON)
// ---------------------------------------------------------------------------

export interface ReminderSettingsFormState {
  success?: string;
  error?: string;
}

export async function saveReminderSettingsAction(
  _prev: ReminderSettingsFormState,
  formData: FormData,
): Promise<ReminderSettingsFormState> {
  const tenant = await requireTenant();

  const hoursRaw = String(formData.get("reminderHoursBefore") ?? "").trim();
  const template = String(formData.get("reminderTemplate") ?? "").trim();

  const hours = parseInt(hoursRaw, 10);
  if (isNaN(hours) || hours < 1 || hours > 168) {
    return { error: "מספר השעות אינו תקין (1–168)" };
  }
  if (!template) {
    return { error: "יש למלא תבנית הודעה" };
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { settings: true },
    });

    const current = (business?.settings ?? {}) as Record<string, unknown>;

    await prisma.business.update({
      where: { id: tenant.businessId },
      data: {
        settings: {
          ...current,
          reminderHoursBefore: hours,
          reminderTemplate: template,
        },
      },
    });
  } catch {
    return { error: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  revalidatePath("/automations");
  revalidatePath("/dashboard");
  return { success: "ההגדרות נשמרו בהצלחה" };
}

// ---------------------------------------------------------------------------
// Mark a booking reminder as sent
// ---------------------------------------------------------------------------

export async function markReminderSentAction(
  bookingId: string,
): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: { id: true, startTime: true },
  });
  if (!booking) return { error: "התור לא נמצא" };

  try {
    const existing = await prisma.reminder.findFirst({
      where: {
        bookingId,
        businessId: tenant.businessId,
        type: "booking_reminder",
      },
    });

    if (existing) {
      await prisma.reminder.update({
        where: { id: existing.id },
        data: { status: "sent" },
      });
    } else {
      await prisma.reminder.create({
        data: {
          businessId: tenant.businessId,
          bookingId,
          type: "booking_reminder",
          dueAt: booking.startTime,
          status: "sent",
        },
      });
    }
  } catch {
    return { error: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  revalidatePath("/automations");
  revalidatePath("/dashboard");
  return { success: "התזכורת סומנה כנשלחה" };
}

// ---------------------------------------------------------------------------
// Reset a sent reminder back to pending
// ---------------------------------------------------------------------------

export async function markReminderPendingAction(
  reminderId: string,
): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();

  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, businessId: tenant.businessId },
  });
  if (!reminder) return { error: "הרשומה לא נמצאה" };

  try {
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: "pending" },
    });
  } catch {
    return { error: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  revalidatePath("/automations");
  revalidatePath("/dashboard");
  return { success: "התזכורת סומנה כממתינה" };
}
