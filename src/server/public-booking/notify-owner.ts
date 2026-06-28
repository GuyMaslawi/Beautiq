/**
 * התראה לבעלת העסק על בקשת תור חדשה שנכנסה מעמוד ההזמנות הציבורי.
 *
 * המטרה: בעלת העסק תדע על הבקשה גם בלי להיכנס למערכת. לכן הערוץ העיקרי
 * הוא אימייל. (התור גם מופיע ממילא כ"ממתין לאישור" בלוח הבקרה — זו שכבה
 * נוספת, לא תחליף.)
 *
 * אופציונלי: התראת WhatsApp לבעלת העסק מאחורי דגל
 * ENABLE_OWNER_WHATSAPP_NOTIFICATION — לעולם לא חובה, לעולם לא חוסם.
 *
 * עקרונות:
 *   - best-effort: לעולם לא זורק כלפי זרימת יצירת ההזמנה.
 *   - idempotent: booking.ownerNotifiedAt מסומן לאחר שליחה מוצלחת, כך
 *     שניסיון חוזר (retry / שליחה כפולה) לא ישלח אימייל נוסף.
 *   - scoping רב-דיירי: ההזמנה נטענת תמיד לפי id + businessId (CLAUDE.md §10).
 *   - האימייל נשלף מנתוני הבעלים (User), לעולם לא קשיח/דמו.
 */

import { prisma } from "@/server/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { APP_URL } from "@/lib/config";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone, toWaPhone } from "@/lib/phone";
import { OWNER_NEW_BOOKING_TEMPLATE } from "@/lib/whatsapp/default-templates";

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

/** קישור ישיר לעמוד ניהול ההזמנות, שם הבעלים מאשרת את התור. */
const BOOKINGS_URL = `${APP_URL}/bookings`;

/**
 * נקודת הכניסה הציבורית — best-effort, לעולם לא זורקת.
 */
export async function notifyOwnerOfNewBooking(params: {
  bookingId: string;
  businessId: string;
}): Promise<void> {
  try {
    await _notify(params);
  } catch (err) {
    logger.error("[notifyOwner] unexpected error", {
      bookingId: params.bookingId,
      errMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

async function _notify(params: {
  bookingId: string;
  businessId: string;
}): Promise<void> {
  const { bookingId, businessId } = params;

  // טוענים את ההזמנה תמיד לפי id + businessId (לעולם לא לפי id בלבד).
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId },
    select: {
      id: true,
      status: true,
      startTime: true,
      ownerNotifiedAt: true,
      priceSnapshot: true,
      clientId: true,
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      business: {
        select: {
          name: true,
          phone: true,
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

  // הזמנה חוצת-דייר / חסרה, או חסרים נתונים → אין למי/מה לשלוח.
  if (!booking || !booking.client) return;

  // idempotency: כבר הותרענו על ההזמנה הזו.
  if (booking.ownerNotifiedAt) return;

  const ownerUser = booking.business.members[0]?.user;
  const ownerEmail = ownerUser?.email?.trim();
  const ownerName = ownerUser?.name?.trim() || booking.business.name;

  const dateStr = formatDate(booking.startTime);
  const timeStr = formatTime(booking.startTime);
  const priceStr = booking.priceSnapshot
    ? `₪${Number(booking.priceSnapshot).toLocaleString("he-IL")}`
    : null;
  const statusLabel = "ממתין לאישור";

  let notified = false;

  // ── ערוץ עיקרי: אימייל לבעלת העסק ──────────────────────────────
  if (ownerEmail) {
    const subject = "בקשת תור חדשה מ־Allura";
    const lines = [
      `היי ${ownerName},`,
      "",
      "נכנסה בקשת תור חדשה דרך עמוד ההזמנות שלך ב־Allura.",
      "",
      `לקוחה: ${booking.client.fullName}`,
      `טלפון: ${booking.client.phone}`,
      `שירות: ${booking.service.name}`,
      `תאריך: ${dateStr}`,
      `שעה: ${timeStr}`,
      ...(priceStr ? [`מחיר: ${priceStr}`] : []),
      `סטטוס: ${statusLabel}`,
      "",
      "ניתן לאשר או לנהל את התור מתוך המערכת:",
      BOOKINGS_URL,
      "",
      "Allura",
    ];
    const text = lines.join("\n");
    const html = buildEmailHtml({
      ownerName,
      clientName: booking.client.fullName,
      clientPhone: booking.client.phone,
      serviceName: booking.service.name,
      dateStr,
      timeStr,
      priceStr,
      statusLabel,
    });

    const result = await sendEmail({ to: ownerEmail, subject, text, html });
    if (result.ok) {
      notified = true;
    } else if (!result.skipped) {
      logger.warn("[notifyOwner] owner email not delivered", {
        bookingId,
        reason: result.reason,
      });
    }
  } else {
    logger.warn("[notifyOwner] no owner email on file", { bookingId, businessId });
  }

  // ── אופציונלי: התראת WhatsApp לבעלת העסק (מאחורי דגל) ──────────
  // לעולם לא חובה ולעולם לא חוסם — נכשל בשקט.
  if (process.env.ENABLE_OWNER_WHATSAPP_NOTIFICATION === "true") {
    const ownerPhone = booking.business.phone?.trim();
    // אין לשלוח אם מספר הבעלים חסר או לא תקין — מדלגים ומתעדים את הסיבה בבירור.
    if (!ownerPhone) {
      logger.warn("[notifyOwner] owner WhatsApp skipped — no business phone on file", {
        bookingId,
        businessId,
      });
    } else if (!isValidIsraeliPhone(ownerPhone)) {
      logger.warn("[notifyOwner] owner WhatsApp skipped — business phone is invalid", {
        bookingId,
        businessId,
      });
    } else {
      // Plain-text fallback (used by the dev mock / logging only). Real production
      // sends go through the approved business_new_booking_he template below.
      const waText =
        `היי ${ownerName},\n` +
        `נכנסה בקשת תור חדשה ב־Allura ✨\n\n` +
        `לקוחה: ${booking.client.fullName}\n` +
        `שירות: ${booking.service.name}\n` +
        `${dateStr} בשעה ${timeStr}\n\n` +
        `לאישור התור:\n${BOOKINGS_URL}`;

      // Persist the owner-notification attempt so it is observable in the admin
      // message log exactly like the customer confirmation (source =
      // "owner_notification", recipient = the masked business phone). Without a
      // row, an enabled owner WhatsApp send would never appear anywhere.
      // The AutomationMessage FK requires a clientId + runId; we reuse the
      // booking's clientId (the row is grouped under the same booking) — the
      // source label is what distinguishes it as the owner copy.
      try {
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
            clientId: booking.clientId,
            bookingId,
            type: "booking_confirmation",
            phone: ownerPhone,
            messageText: waText,
            templateId: OWNER_NEW_BOOKING_TEMPLATE.name,
            templateLanguage: OWNER_NEW_BOOKING_TEMPLATE.language,
            status: "queued",
            source: "owner_notification",
          },
        });

        const provider = await getWhatsAppProviderForBusiness(businessId);
        const sent = await provider.send({
          businessId,
          toPhone: toWaPhone(ownerPhone),
          // Approved Allura-WABA template — the Meta provider rejects free-text
          // sends, so an owner notification can only deliver through this template.
          templateId: OWNER_NEW_BOOKING_TEMPLATE.name,
          templateLanguage: OWNER_NEW_BOOKING_TEMPLATE.language,
          templateVariables: {
            "1": ownerName,
            "2": booking.client.fullName,
            "3": booking.service.name,
            "4": dateStr,
            "5": timeStr,
          },
          fallbackText: waText,
          automationRunId: run.id,
          clientId: booking.clientId,
        });

        if (sent.success || sent.isMockSkip) {
          await prisma.automationMessage.update({
            where: { id: msg.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              providerMessageId: sent.providerMessageId ?? undefined,
              templateLanguage: OWNER_NEW_BOOKING_TEMPLATE.language,
              phoneNumberId: sent.phoneNumberIdUsed ?? undefined,
            },
          });
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "completed", finishedAt: new Date(), sentCount: 1 },
          });
          notified = true;
        } else {
          await prisma.automationMessage.update({
            where: { id: msg.id },
            data: {
              status: "failed",
              failedAt: new Date(),
              failureReason: sent.failureReason ?? "שגיאה לא ידועה",
              phoneNumberId: sent.phoneNumberIdUsed ?? undefined,
              errorCode: sent.metaError?.code ?? undefined,
              errorSubcode: sent.metaError?.subcode ?? undefined,
              errorType: sent.metaError?.type ?? undefined,
              errorFbtraceId: sent.metaError?.fbtraceId ?? undefined,
              errorRaw: sent.metaError?.rawSanitized ?? undefined,
            },
          });
          await prisma.automationRun.update({
            where: { id: run.id },
            data: { status: "failed", finishedAt: new Date(), failedCount: 1 },
          });
          logger.warn("[notifyOwner] owner WhatsApp not delivered", {
            bookingId,
            reason: sent.failureReason,
          });
        }
      } catch (err) {
        logger.warn("[notifyOwner] owner WhatsApp failed", {
          bookingId,
          errMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // מסמנים כהותרע רק אם משהו אכן נשלח — כדי לאפשר ניסיון חוזר אם השירות
  // לא היה מוגדר (skipped), ולמנוע כפילות לאחר שליחה מוצלחת.
  if (notified) {
    await prisma.booking
      .update({
        where: { id: bookingId },
        data: { ownerNotifiedAt: new Date() },
      })
      .catch((err) =>
        logger.warn("[notifyOwner] failed to mark ownerNotifiedAt", {
          bookingId,
          errMessage: err instanceof Error ? err.message : String(err),
        }),
      );
  }
}

function buildEmailHtml(v: {
  ownerName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  dateStr: string;
  timeStr: string;
  priceStr: string | null;
  statusLabel: string;
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#8a7f86;white-space:nowrap">${label}</td>` +
    `<td style="padding:4px 0;color:#2b2229;font-weight:600">${value}</td></tr>`;
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#faf7f8;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #efe6ec">
      <h1 style="font-size:18px;margin:0 0 4px;color:#2b2229">בקשת תור חדשה ✨</h1>
      <p style="margin:0 0 16px;color:#8a7f86;font-size:14px">היי ${v.ownerName}, נכנסה בקשת תור חדשה דרך עמוד ההזמנות שלך ב־Allura.</p>
      <table style="font-size:14px;border-collapse:collapse;width:100%">
        ${row("לקוחה", v.clientName)}
        ${row("טלפון", v.clientPhone)}
        ${row("שירות", v.serviceName)}
        ${row("תאריך", v.dateStr)}
        ${row("שעה", v.timeStr)}
        ${v.priceStr ? row("מחיר", v.priceStr) : ""}
        ${row("סטטוס", v.statusLabel)}
      </table>
      <a href="${BOOKINGS_URL}" style="display:inline-block;margin-top:20px;background:#b86b8c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;font-size:14px">לאישור וניהול התור</a>
    </div>
    <p style="text-align:center;color:#b3a8b0;font-size:12px;margin:16px 0 0">Allura</p>
  </div>
</body></html>`;
}
