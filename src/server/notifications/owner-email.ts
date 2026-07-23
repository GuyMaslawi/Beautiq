/**
 * התראות אימייל לבעלת העסק על פעולות שקשורות ללקוחות.
 *
 * ברירת המחדל: כבוי. בעלת העסק מפעילה את ההתראות מעמוד ההגדרות
 * (Business.emailNotificationsEnabled). כשההעדפה דלוקה — כל פעולה משמעותית
 * סביב תור (נקבע / בוטל / לא הגיעה / הושלם) שולחת לה אימייל, לשקיפות מלאה.
 *
 * עקרונות:
 *   - opt-in: לא נשלח כלום אלא אם ההעדפה דלוקה.
 *   - best-effort: לעולם לא זורק כלפי הזרימה העסקית שקראה לו.
 *   - multi-tenant: ההזמנה נטענת תמיד לפי id + businessId (CLAUDE.md §10).
 *   - האימייל נשלף מבעלת העסק (User), לעולם לא קשיח.
 *
 * ההתראה על תור חדש מעמוד ההזמנות הציבורי מטופלת ב-notify-owner.ts (שם יש גם
 * ערוץ WhatsApp אופציונלי ו-idempotency); שתי הנקודות מכבדות את אותה העדפה.
 */

import { prisma } from "@/server/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { APP_URL } from "@/lib/config";

export type OwnerClientEvent =
  | "booking_created"
  | "booking_cancelled"
  | "booking_no_show"
  | "booking_completed";

const EVENT_COPY: Record<OwnerClientEvent, { subject: string; headline: string }> = {
  booking_created: { subject: "תור חדש נקבע ב־Allura", headline: "נקבע תור חדש" },
  booking_cancelled: { subject: "תור בוטל ב־Allura", headline: "תור בוטל" },
  booking_no_show: { subject: "לקוחה לא הגיעה — Allura", headline: "לקוחה סומנה כלא הגיעה" },
  booking_completed: { subject: "תור הושלם ב־Allura", headline: "תור הושלם" },
};

const BOOKINGS_URL = `${APP_URL}/bookings`;

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

/**
 * נקודת כניסה ציבורית — best-effort, לעולם לא זורקת. מדלגת בשקט אם ההעדפה כבויה
 * או שאין אימייל בעלים / שירות אימייל לא מוגדר.
 */
export async function notifyOwnerOfClientEvent(params: {
  businessId: string;
  bookingId: string;
  event: OwnerClientEvent;
}): Promise<void> {
  try {
    await _notify(params);
  } catch (err) {
    logger.error("[ownerEmail] unexpected error", {
      bookingId: params.bookingId,
      event: params.event,
      errMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

async function _notify(params: {
  businessId: string;
  bookingId: string;
  event: OwnerClientEvent;
}): Promise<void> {
  const { businessId, bookingId, event } = params;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId },
    select: {
      startTime: true,
      priceSnapshot: true,
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      business: {
        select: {
          name: true,
          emailNotificationsEnabled: true,
          members: {
            where: { role: "owner" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { user: { select: { email: true, name: true } } },
          },
        },
      },
    },
  });

  // הזמנה חוצת-דייר / חסרה, או שההעדפה כבויה → אין מה לשלוח.
  if (!booking || !booking.client) return;
  if (!booking.business.emailNotificationsEnabled) return;

  const ownerUser = booking.business.members[0]?.user;
  const ownerEmail = ownerUser?.email?.trim();
  if (!ownerEmail) {
    logger.warn("[ownerEmail] no owner email on file", { bookingId, businessId });
    return;
  }
  const ownerName = ownerUser?.name?.trim() || booking.business.name;

  const copy = EVENT_COPY[event];
  const dateStr = formatDate(booking.startTime);
  const timeStr = formatTime(booking.startTime);
  const priceStr = booking.priceSnapshot
    ? `₪${Number(booking.priceSnapshot).toLocaleString("he-IL")}`
    : null;

  const lines = [
    `היי ${ownerName},`,
    "",
    `${copy.headline}:`,
    "",
    `לקוחה: ${booking.client.fullName}`,
    `טלפון: ${booking.client.phone}`,
    `שירות: ${booking.service.name}`,
    `תאריך: ${dateStr}`,
    `שעה: ${timeStr}`,
    ...(priceStr ? [`מחיר: ${priceStr}`] : []),
    "",
    "לצפייה וניהול התורים:",
    BOOKINGS_URL,
    "",
    "Allura",
  ];

  const html = buildEmailHtml({
    ownerName,
    headline: copy.headline,
    clientName: booking.client.fullName,
    clientPhone: booking.client.phone,
    serviceName: booking.service.name,
    dateStr,
    timeStr,
    priceStr,
  });

  const result = await sendEmail({
    to: ownerEmail,
    subject: copy.subject,
    text: lines.join("\n"),
    html,
  });
  if (!result.ok && !result.skipped) {
    logger.warn("[ownerEmail] not delivered", { bookingId, event, reason: result.reason });
  }
}

function buildEmailHtml(v: {
  ownerName: string;
  headline: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  dateStr: string;
  timeStr: string;
  priceStr: string | null;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#8a7f86;white-space:nowrap">${label}</td>` +
    `<td style="padding:4px 0;color:#2b2229;font-weight:600">${value}</td></tr>`;
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#faf7f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #efe6ec">
      <h1 style="font-size:18px;margin:0 0 4px;color:#2b2229">${v.headline} ✨</h1>
      <p style="margin:0 0 16px;color:#8a7f86;font-size:14px">היי ${v.ownerName}, עדכון מ־Allura על פעולה בתור.</p>
      <table style="font-size:14px;border-collapse:collapse;width:100%">
        ${row("לקוחה", v.clientName)}
        ${row("טלפון", v.clientPhone)}
        ${row("שירות", v.serviceName)}
        ${row("תאריך", v.dateStr)}
        ${row("שעה", v.timeStr)}
        ${v.priceStr ? row("מחיר", v.priceStr) : ""}
      </table>
      <a href="${BOOKINGS_URL}" style="display:inline-block;margin-top:20px;background:#ac5c7f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;font-size:14px">לצפייה וניהול התורים</a>
    </div>
    <p style="text-align:center;color:#b3a8b0;font-size:12px;margin:16px 0 0">Allura</p>
  </div>
</body></html>`;
}
