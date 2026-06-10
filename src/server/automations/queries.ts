import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { AUTOMATIONS } from "@/lib/constants/he";

const TZ = "Asia/Jerusalem";

export const DEFAULT_REMINDER_HOURS = 24;
export const DEFAULT_REMINDER_TEMPLATE =
  AUTOMATIONS.reminders.settings.templateDefault;

export interface ReminderSettings {
  reminderHoursBefore: number;
  reminderTemplate: string;
}

function parseSettings(settings: unknown): ReminderSettings {
  if (!settings || typeof settings !== "object") {
    return {
      reminderHoursBefore: DEFAULT_REMINDER_HOURS,
      reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
    };
  }
  const s = settings as Record<string, unknown>;
  return {
    reminderHoursBefore:
      typeof s.reminderHoursBefore === "number" && s.reminderHoursBefore >= 1
        ? s.reminderHoursBefore
        : DEFAULT_REMINDER_HOURS,
    reminderTemplate:
      typeof s.reminderTemplate === "string" && s.reminderTemplate.trim()
        ? s.reminderTemplate
        : DEFAULT_REMINDER_TEMPLATE,
  };
}

export async function getReminderSettings(
  tenant: TenantContext,
): Promise<ReminderSettings> {
  const business = await prisma.business.findUnique({
    where: { id: tenant.businessId },
    select: { settings: true },
  });
  return parseSettings(business?.settings);
}

export interface ReminderDueItem {
  bookingId: string;
  clientName: string;
  phone: string;
  serviceName: string;
  startTimeISO: string;
  /** null = no reminder record exists yet */
  reminderId: string | null;
  /** null = no record; "pending" = record exists but not sent */
  reminderStatus: "pending" | "sent" | "cancelled" | "failed" | null;
  message: string;
}

function buildMessage(
  template: string,
  clientName: string,
  serviceName: string,
  businessName: string,
  startTime: Date,
): string {
  const date = startTime.toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = startTime.toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return template
    .replace(/\{שם\}/g, clientName)
    .replace(/\{שירות\}/g, serviceName)
    .replace(/\{שם העסק\}/g, businessName)
    .replace(/\{תאריך\}/g, date)
    .replace(/\{שעה\}/g, time)
    .replace(/\{קישור להזמנה\}/g, "");
}

export interface RemindersData {
  settings: ReminderSettings;
  remindersDue: ReminderDueItem[];
  /** How many are pending (no sent reminder record) */
  pendingCount: number;
}

export async function getRemindersData(
  tenant: TenantContext,
): Promise<RemindersData> {
  const [settingsResult, business] = await Promise.all([
    prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { settings: true, name: true },
    }),
    prisma.business.findUnique({
      where: { id: tenant.businessId },
      select: { name: true },
    }),
  ]);

  const settings = parseSettings(settingsResult?.settings);
  const businessName = business?.name ?? "";

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + settings.reminderHoursBefore * 3600 * 1000,
  );

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      startTime: {
        gte: now,
        lte: windowEnd,
      },
      status: { in: ["pending", "approved"] },
    },
    include: {
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      reminders: {
        where: { type: "booking_reminder" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { startTime: "asc" },
  });

  const remindersDue: ReminderDueItem[] = bookings.map((booking) => {
    const reminder = booking.reminders[0] ?? null;
    const message = buildMessage(
      settings.reminderTemplate,
      booking.client.fullName,
      booking.service.name,
      businessName,
      booking.startTime,
    );

    return {
      bookingId: booking.id,
      clientName: booking.client.fullName,
      phone: booking.client.phone,
      serviceName: booking.service.name,
      startTimeISO: booking.startTime.toISOString(),
      reminderId: reminder?.id ?? null,
      reminderStatus: reminder
        ? (reminder.status as ReminderDueItem["reminderStatus"])
        : null,
      message,
    };
  });

  const pendingCount = remindersDue.filter(
    (r) =>
      r.reminderStatus === null ||
      r.reminderStatus === "pending" ||
      r.reminderStatus === "failed",
  ).length;

  return { settings, remindersDue, pendingCount };
}

/** Lightweight count for the dashboard attention card */
export async function getRemindersDueCount(
  tenant: TenantContext,
): Promise<number> {
  const business = await prisma.business.findUnique({
    where: { id: tenant.businessId },
    select: { settings: true },
  });
  const settings = parseSettings(business?.settings);

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + settings.reminderHoursBefore * 3600 * 1000,
  );

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: tenant.businessId,
      startTime: { gte: now, lte: windowEnd },
      status: { in: ["pending", "approved"] },
    },
    include: {
      reminders: {
        where: { type: "booking_reminder", status: "sent" },
        take: 1,
      },
    },
  });

  return bookings.filter((b) => b.reminders.length === 0).length;
}
