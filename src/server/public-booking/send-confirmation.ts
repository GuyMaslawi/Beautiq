/**
 * Best-effort WhatsApp booking confirmation.
 *
 * Triggered from two places (see {@link sendBookingConfirmation} for the
 * public flow and {@link sendBookingConfirmationById} for owner/internal
 * flows):
 *   - immediately after a public booking request is created;
 *   - when an owner creates an already-approved booking, or approves a
 *     pending one, from the internal Bookings page.
 *
 * Every attempt (sent, skipped, or failed) creates an AutomationRun +
 * AutomationMessage so it appears in the message log with a safe, non-secret
 * reason — sending never fails silently.
 *
 * This is best-effort — errors are caught and never propagate to the booking
 * creation/approval flow.
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
  source: string,
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
      source,
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
  /** Audit-trail origin. Defaults to the public booking page. */
  source?: string;
}): Promise<void> {
  try {
    await _send(params);
  } catch (err) {
    console.error("[sendBookingConfirmation] unexpected error:", err);
  }
}

/**
 * Trigger the confirmation from an owner/internal flow given only a booking id.
 *
 * Loads the booking (scoped by businessId — never by id alone, CLAUDE.md §10),
 * verifies it is approved, and is idempotent: a booking whose
 * `confirmationSentAt` is already set is a no-op, so re-approving or repeating
 * the action never double-sends. All other safety guards (phone, opt-out,
 * template, connection, real-send env) are enforced downstream by {@link _send}.
 */
export async function sendBookingConfirmationById(params: {
  bookingId: string;
  businessId: string;
  /** Audit-trail origin. Defaults to an owner-initiated action. */
  source?: string;
}): Promise<void> {
  const { bookingId, businessId, source = "manual_owner" } = params;
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      select: {
        id: true,
        status: true,
        startTime: true,
        confirmationSentAt: true,
        client: { select: { id: true, fullName: true, phone: true } },
        service: { select: { name: true } },
        business: { select: { name: true } },
      },
    });

    // Cross-tenant / missing booking, or not (yet) approved → nothing to send.
    if (!booking || !booking.client) return;
    if (booking.status !== "approved") return;
    // Idempotency: a confirmation already went out for this booking.
    if (booking.confirmationSentAt) return;

    await _send({
      bookingId: booking.id,
      businessId,
      businessName: booking.business.name,
      clientId: booking.client.id,
      clientPhone: booking.client.phone,
      clientName: booking.client.fullName,
      serviceName: booking.service.name,
      startTime: booking.startTime,
      source,
    });
  } catch (err) {
    console.error("[sendBookingConfirmationById] unexpected error:", err);
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
  source?: string;
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
    source = "public_booking",
  } = params;

  // Phone check
  if (!isValidIsraeliPhone(clientPhone)) {
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "אין מספר טלפון תקין", source).catch(() => {});
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
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "הלקוחה לא מעוניינת בקבלת הודעות", source).catch(() => {});
    return;
  }

  if (requireOptIn && !client?.whatsappOptIn) {
    await createSkippedRun(businessId, clientId, bookingId, clientPhone, "הלקוחה לא אישרה קבלת הודעות WhatsApp", source).catch(() => {});
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
      source,
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
