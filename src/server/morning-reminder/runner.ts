/**
 * Morning-reminder runner — per-business execution with full audit trail.
 *
 * Creates one AutomationRun per execution and one AutomationMessage per booking
 * so every attempt is visible in the message log and can be tracked over time.
 *
 * Called by:
 *  - /api/cron/morning-reminder (bypassHourCheck=false, source="cron")
 *  - /api/admin/automation/reminder-now (bypassHourCheck=true, source="manual_admin")
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";

const DEFAULT_REMINDER_BODY =
  "בוקר טוב {שם הלקוח} ☀️\n\nרק תזכורת קטנה שיש לך היום תור ב:\n\n🕒 {שעה}\n✨ {שירות}\n\nמחכות לראותך ❤️\n{שם העסק}";

function formatTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

function applyVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{[^}]+\}/g, (m) => vars[m] ?? m);
}

function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

function getDateString(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export interface ReminderRunResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  runId?: string;
  alreadyRan?: boolean;
  error?: string;
}

export async function runMorningReminderForBusiness(params: {
  businessId: string;
  sendHour: number;
  thresholdDays: number;
  messageTemplate?: string | null;
  requireOptIn?: boolean;
  bypassHourCheck?: boolean;
  now?: Date;
}): Promise<ReminderRunResult> {
  const {
    businessId,
    sendHour,
    thresholdDays,
    messageTemplate,
    requireOptIn = false,
    bypassHourCheck = false,
    now = new Date(),
  } = params;

  const israelHour = parseInt(
    new Intl.DateTimeFormat("he-IL", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(now),
    10,
  );

  // Fixed-hour mode: only fire at the configured hour (skipped when bypass=true for admin)
  if (!bypassHourCheck && sendHour >= 0 && sendHour !== israelHour) {
    return { success: true, sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, timezone: true },
  });
  if (!business) {
    return { success: false, sentCount: 0, failedCount: 0, skippedCount: 0, error: "Business not found" };
  }

  const tz = business.timezone ?? "Asia/Jerusalem";

  // Idempotency guard: skip if a run already completed in the last 60 min.
  // Not applied when admin bypasses hour-check (they explicitly want a fresh run).
  if (!bypassHourCheck) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const existingRun = await prisma.automationRun.findFirst({
      where: {
        businessId,
        type: "morning_reminder",
        startedAt: { gte: oneHourAgo },
        status: { in: ["running", "completed", "partial"] },
      },
    });
    if (existingRun) {
      console.log(
        `[morning-reminder] skip businessId=${businessId} — run exists (${existingRun.id})`,
      );
      return { success: true, sentCount: 0, failedCount: 0, skippedCount: 0, runId: existingRun.id, alreadyRan: true };
    }
  }

  // Build the booking time window based on timing mode
  let startWindow: Date;
  let endWindow: Date;

  if (sendHour < 0) {
    // Relative mode: target bookings starting in abs(sendHour) hours ± 30 min
    const hoursAhead = Math.abs(sendHour);
    const target = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    startWindow = new Date(target.getTime() - 30 * 60 * 1000);
    endWindow = new Date(target.getTime() + 30 * 60 * 1000);
  } else if (thresholdDays === 1) {
    // Evening-before mode: send reminders for tomorrow's bookings
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = getDateString(tomorrow, tz);
    startWindow = new Date(`${tomorrowStr}T00:00:00`);
    endWindow = new Date(`${tomorrowStr}T23:59:59`);
  } else {
    // Same-day morning mode: send for today's bookings
    const todayStr = getDateString(now, tz);
    startWindow = new Date(`${todayStr}T00:00:00`);
    endWindow = new Date(`${todayStr}T23:59:59`);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      status: { in: ["pending", "approved"] },
      reminderSentAt: null,
      startTime: { gte: startWindow, lte: endWindow },
    },
    include: {
      client: { select: { fullName: true, normalizedPhone: true, unsubscribedAt: true, whatsappOptIn: true } },
      service: { select: { name: true } },
    },
  });

  if (bookings.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  // Resolve message body: setting override → custom template → system default
  let body = DEFAULT_REMINDER_BODY;
  if (messageTemplate) {
    body = messageTemplate;
  } else {
    const customTpl = await prisma.messageTemplate.findUnique({
      where: { businessId_type: { businessId, type: "booking_reminder" } },
      select: { body: true, isActive: true },
    });
    if (customTpl?.isActive && customTpl.body) body = customTpl.body;
  }

  const provider = await getWhatsAppProviderForBusiness(businessId);
  const source = bypassHourCheck ? "manual_admin" : "cron";

  // Create the run record — all messages in this batch belong to this run
  const run = await prisma.automationRun.create({
    data: { businessId, type: "morning_reminder", status: "running", eligibleCount: bookings.length },
  });

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const booking of bookings) {
    const phone = booking.client.normalizedPhone;

    if (!isValidIsraeliPhone(phone)) {
      await prisma.automationMessage.create({
        data: {
          businessId,
          runId: run.id,
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "morning_reminder",
          phone: phone ?? "",
          messageText: "",
          status: "skipped",
          failureReason: "אין מספר טלפון תקין",
          source,
        },
      });
      skippedCount++;
      continue;
    }

    if (booking.client.unsubscribedAt) {
      await prisma.automationMessage.create({
        data: {
          businessId,
          runId: run.id,
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "morning_reminder",
          phone,
          messageText: "",
          status: "skipped",
          failureReason: "הלקוחה לא מעוניינת בקבלת הודעות",
          source,
        },
      });
      skippedCount++;
      continue;
    }

    if (requireOptIn && !booking.client.whatsappOptIn) {
      await prisma.automationMessage.create({
        data: {
          businessId,
          runId: run.id,
          clientId: booking.clientId,
          bookingId: booking.id,
          type: "morning_reminder",
          phone,
          messageText: "",
          status: "skipped",
          failureReason: "הלקוחה לא אישרה קבלת הודעות WhatsApp",
          source,
        },
      });
      skippedCount++;
      continue;
    }

    const vars: Record<string, string> = {
      "{שם הלקוח}": booking.client.fullName,
      "{שם הלקוחה}": booking.client.fullName,
      "{שם העסק}": business.name,
      "{שירות}": booking.service.name,
      "{שעה}": formatTime(booking.startTime, tz),
      "{clientName}": booking.client.fullName,
      "{businessName}": business.name,
      "{serviceName}": booking.service.name,
      "{bookingTime}": formatTime(booking.startTime, tz),
    };
    const messageText = applyVariables(body, vars);

    const msg = await prisma.automationMessage.create({
      data: {
        businessId,
        runId: run.id,
        clientId: booking.clientId,
        bookingId: booking.id,
        type: "morning_reminder",
        phone,
        messageText,
        status: "queued",
        source,
      },
    });

    try {
      const result = await provider.send({
        businessId,
        toPhone: toWaNumber(phone),
        fallbackText: messageText,
        automationRunId: run.id,
        clientId: booking.clientId,
      });

      if (result.success || result.isMockSkip) {
        await prisma.$transaction([
          prisma.automationMessage.update({
            where: { id: msg.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              providerMessageId: result.providerMessageId ?? undefined,
            },
          }),
          prisma.booking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() },
          }),
        ]);
        sentCount++;
      } else {
        await prisma.automationMessage.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            failedAt: new Date(),
            failureReason: result.failureReason ?? "שגיאה לא ידועה",
          },
        });
        failedCount++;
        console.warn(
          `[morning-reminder] failed bookingId=${booking.id}: ${result.failureReason}`,
        );
      }
    } catch (err) {
      await prisma.automationMessage
        .update({
          where: { id: msg.id },
          data: { status: "failed", failedAt: new Date(), failureReason: String(err) },
        })
        .catch(() => {});
      failedCount++;
      console.error(`[morning-reminder] error bookingId=${booking.id}:`, err);
    }
  }

  const finalStatus =
    sentCount > 0 && failedCount === 0
      ? "completed"
      : sentCount > 0
      ? "partial"
      : failedCount > 0
      ? "failed"
      : "completed";

  await prisma.automationRun.update({
    where: { id: run.id },
    data: { status: finalStatus, finishedAt: new Date(), sentCount, failedCount, skippedCount },
  });

  return { success: true, sentCount, failedCount, skippedCount, runId: run.id };
}
