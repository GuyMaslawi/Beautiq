/**
 * שליחת אימייל — שכבה גנרית, best-effort, ללא תלות חיצונית.
 *
 * השליחה מתבצעת דרך ה-HTTP API של Resend (קריאת fetch אחת) כדי לא להוסיף
 * תלות npm (CLAUDE.md §4). אם השירות לא מוגדר (אין RESEND_API_KEY / EMAIL_FROM)
 * — הפונקציה אינה זורקת: היא רושמת ללוג ומחזירה skipped. כך שליחת אימייל
 * לעולם אינה שוברת זרימה עסקית (יצירת הזמנה וכו').
 *
 * הגדרת סביבה נדרשת לשליחה אמיתית:
 *   RESEND_API_KEY   — מפתח ה-API של Resend
 *   EMAIL_FROM       — כתובת השולח המאומתת (למשל "Allura <noreply@allura.info>")
 */

import { logger } from "@/lib/logger";

export interface SendEmailParams {
  to: string;
  subject: string;
  /** גוף טקסט פשוט (חובה — fallback נגיש תמיד). */
  text: string;
  /** גוף HTML אופציונלי. */
  html?: string;
  /** כתובת להשבה (Reply-To), אם שונה מהשולח. */
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; skipped?: false; id?: string }
  /** לא נשלח אך גם לא נכשל — השירות פשוט לא מוגדר (פיתוח / טרם הוגדר). */
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; reason: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** האם תצורת האימייל קיימת (מאפשר שליחה אמיתית). */
export function isEmailConfigured(): boolean {
  return (
    !!process.env.RESEND_API_KEY?.trim() && !!process.env.EMAIL_FROM?.trim()
  );
}

/**
 * שולח אימייל. לעולם אינו זורק — מחזיר תוצאה מובנית כדי שהקורא יחליט מה לרשום.
 */
export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    // לא מוגדר — לא שגיאה. בפיתוח שימושי לראות שהאימייל "היה אמור" להישלח.
    logger.info("[email] dispatch skipped — email service not configured", {
      to: params.to,
      subject: params.subject,
    });
    return { ok: false, skipped: true, reason: "email_not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      // קוראים את גוף השגיאה לתיעוד בלבד — לעולם לא חושפים מפתח API.
      const detail = await res.text().catch(() => "");
      logger.warn("[email] provider returned non-OK", {
        status: res.status,
        detail: detail.slice(0, 500),
      });
      return { ok: false, reason: `provider_status_${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error("[email] dispatch failed", {
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "dispatch_error" };
  }
}
