/**
 * Best-effort WhatsApp booking confirmation sent immediately after a public
 * booking request is created.
 *
 * Resolves the message body from the business's booking_confirmation template
 * (or a system default), substitutes variables, then hands off to the
 * configured WhatsApp provider.
 *
 * This is fire-and-forget — errors are logged but never propagate to the
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

function applyVariables(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{[^}]+\}/g, (match) => vars[match] ?? match);
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

  if (!isValidIsraeliPhone(clientPhone)) return;

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

  try {
    const provider = await getWhatsAppProviderForBusiness(businessId);
    const result = await provider.send({
      businessId,
      toPhone: toWaNumber(clientPhone),
      fallbackText: messageText,
      automationRunId: bookingId,
      clientId,
    });

    if (result.success || result.isMockSkip) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { confirmationSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error("[sendBookingConfirmation] error:", err);
  }
}
