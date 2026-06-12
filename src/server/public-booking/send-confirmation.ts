/**
 * Best-effort WhatsApp booking confirmation sent immediately after a public
 * booking request is created.
 *
 * Every attempt (sent, skipped, or failed) creates an AutomationRun +
 * AutomationMessage so it appears in the message log.
 *
 * This is fire-and-forget — errors are caught and never propagate to the
 * booking creation flow.
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";

const DEFAULT_BODY =
  "היי {שם הלקוח} 💖\n\nהבקשה לתור שלך התקבלה!\n\n📅 {תאריך}\n🕒 {שעה}\n✨ {שירות}\n\nנאשר את התור בהקדם ❤️\n{שם העסק}";

function toWaNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "972" + digits.slice(1) : digits;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

function applyVariables(body: string, vars: Record<string, string>): string {
  return body.replace(/\{[^}]+\}/g, (match) => vars[match] ?? match);
}

async function createSkippedRun(
  businessId: string,
  clientId: string,
  bookingId: string,
  phone: string,
  failureReason: string,
): Promise<void> {
  const run = await prisma.automationRun.create({
    data: {
      businessId,
      type: "booking_confirmation",
      status: "completed",
      eligibleCount: 1,
      skippedCount: 1,
      finishedAt: new Date(),
    },
  });
  await prisma.automationMessage.create({
    data: {
      businessId,
      runId: run.id,
      clientId,
      bookingId,
      type: "booking_confirmation",
      phone,
      messageText: "",
      status: "skipped",
      failureReason,
      source: "public_booking",
    },
  });
}

export async function sendBookingConfirmation(params: {
  bookingId: string;
  businessId: string;
  businessName: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
}): Promise<void> {
  try {
    await _send(params);
  } catch (err) {
    console.error("[sendBookingConfirmation] unexpected error:", err);
  }
}

async function _send(params: {
  bookingId: string;
  businessId: string;
  businessName: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
}): Promise<void> {
  const {
    bookingId,
    businessId,
    businessName,
    clientId,
    clientPhone,
    clientName,
    serviceName,
    startTime,
  } = params;

  // Phone check
  if (!isValidIsraeliPhone(clientPhone)) {
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "אין מספר טלפון תקין").catch(() => {});
    return;
  }

  // Load client opt-in fields + booking_confirmation requireOptIn + template settings in parallel.
  // Booking confirmation is transactional — requireOptIn defaults to false if no setting exists.
  const [client, confirmationSetting] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { unsubscribedAt: true, whatsappOptIn: true },
    }),
    prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "booking_confirmation" } },
      select: { requireOptIn: true, templateName: true, templateLanguage: true },
    }),
  ]);

  const requireOptIn = confirmationSetting?.requireOptIn ?? false;
  const templateName = confirmationSetting?.templateName ?? null;
  const templateLanguage = confirmationSetting?.templateLanguage ?? "he";
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";

  if (client?.unsubscribedAt) {
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "הלקוחה לא מעוניינת בקבלת הודעות").catch(() => {});
    return;
  }

  if (requireOptIn && !client?.whatsappOptIn) {
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "הלקוחה לא אישרה קבלת הודעות WhatsApp").catch(() => {});
    return;
  }

  // Resolve template body
  let body = DEFAULT_BODY;
  try {
    const customTpl = await prisma.messageTemplate.findUnique({
      where: { businessId_type: { businessId, type: "booking_confirmation" } },
      select: { body: true, isActive: true },
    });
    if (customTpl?.isActive && customTpl.body) {
      body = customTpl.body;
    } else {
      const sysTpl = await prisma.systemMessageTemplate.findUnique({
        where: { type: "booking_confirmation" },
        select: { body: true, isActive: true },
      });
      if (sysTpl?.isActive && sysTpl.body) body = sysTpl.body;
    }
  } catch {
    // Non-critical — use default
  }

  const vars: Record<string, string> = {
    "{שם הלקוח}": clientName,
    "{שם הלקוחה}": clientName,
    "{שם העסק}": businessName,
    "{שירות}": serviceName,
    "{תאריך}": formatDate(startTime),
    "{שעה}": formatTime(startTime),
    "{clientName}": clientName,
    "{businessName}": businessName,
    "{serviceName}": serviceName,
    "{bookingDate}": formatDate(startTime),
    "{bookingTime}": formatTime(startTime),
  };

  const messageText = applyVariables(body, vars);

  // Create run + queued message before attempting send
  const run = await prisma.automationRun.create({
    data: {
      businessId,
      type: "booking_confirmation",
      status: "running",
      eligibleCount: 1,
    },
  });

  const msg = await prisma.automationMessage.create({
    data: {
      businessId,
      runId: run.id,
      clientId,
      bookingId,
      type: "booking_confirmation",
      phone: clientPhone,
      messageText,
      status: "queued",
      source: "public_booking",
    },
  });

  // In real-send mode a Meta-approved templateName is required
  if (realSendEnabled && !templateName) {
    await prisma.automationMessage
      .update({
        where: { id: msg.id },
        data: { status: "skipped", failureReason: "תבנית ההודעה עדיין לא מוגדרת" },
      })
      .catch(() => {});
    await prisma.automationRun
      .update({ where: { id: run.id }, data: { status: "completed", finishedAt: new Date(), skippedCount: 1 } })
      .catch(() => {});
    return;
  }

  try {
    const provider = await getWhatsAppProviderForBusiness(businessId);
    const templateVariables = templateName
      ? {
          "1": clientName,
          "2": serviceName,
          "3": formatDate(startTime),
          "4": formatTime(startTime),
        }
      : undefined;

    const result = await provider.send({
      businessId,
      toPhone: toWaNumber(clientPhone),
      templateId: templateName ?? undefined,
      templateLanguage,
      templateVariables,
      fallbackText: messageText,
      automationRunId: run.id,
      clientId,
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
          where: { id: bookingId },
          data: { confirmationSentAt: new Date() },
        }),
      ]);
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "completed", finishedAt: new Date(), sentCount: 1 },
      });
    } else {
      const reason = result.failureReason ?? "שגיאה לא ידועה";
      await prisma.automationMessage.update({
        where: { id: msg.id },
        data: { status: "failed", failedAt: new Date(), failureReason: reason },
      });
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "failed", finishedAt: new Date(), failedCount: 1 },
      });
      console.warn(`[sendBookingConfirmation] failed bookingId=${bookingId}: ${reason}`);
    }
  } catch (err) {
    const reason = String(err);
    await prisma.automationMessage
      .update({ where: { id: msg.id }, data: { status: "failed", failedAt: new Date(), failureReason: reason } })
      .catch(() => {});
    await prisma.automationRun
      .update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), failedCount: 1 } })
      .catch(() => {});
    console.error("[sendBookingConfirmation] send error:", err);
  }
}
