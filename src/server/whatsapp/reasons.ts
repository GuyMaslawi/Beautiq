/**
 * Stable, machine-readable reasons a WhatsApp message was skipped, blocked, or
 * failed — plus their Hebrew labels for the owner/admin UI.
 *
 * These codes are the contract between the diagnostics engine (dry-run), the
 * send pipeline, and the admin UI. Storing a code (not just free text) means a
 * "message not sent" is never one generic failure — it always maps to an exact,
 * filterable reason.
 *
 * SAFETY: labels never contain secrets, tokens, or raw credentials.
 */

export type WhatsAppSendReason =
  | "ok"
  | "missing_connection"
  | "real_send_disabled"
  | "dev_mode"
  | "test_mode_recipient_mismatch"
  | "test_phone_not_set"
  | "missing_template"
  | "template_not_approved"
  | "template_language_mismatch"
  | "invalid_phone"
  | "unsubscribed"
  | "cooldown"
  | "provider_error"
  | "no_trigger"
  | "unknown";

/** Hebrew, owner/admin-safe label for each reason code. */
export const WHATSAPP_REASON_LABELS: Record<WhatsAppSendReason, string> = {
  ok: "מוכן לשליחה",
  missing_connection: "אין חיבור WhatsApp פעיל לעסק",
  real_send_disabled: "שליחה אמיתית כבויה (ENABLE_REAL_WHATSAPP_SEND)",
  dev_mode: "מצב פיתוח — הודעות לא נשלחות בפועל",
  test_mode_recipient_mismatch: "מצב בדיקה — שליחה מותרת רק למספר הבדיקה",
  test_phone_not_set: "מצב בדיקה פעיל אך מספר הבדיקה לא הוגדר",
  missing_template: "תבנית ההודעה עדיין לא מוגדרת",
  template_not_approved: "תבנית ההודעה עדיין לא אושרה על ידי Meta",
  template_language_mismatch:
    "התבנית קיימת ב-Meta אך לא בשפה הנדרשת (עברית) — נדרשת גרסה בעברית",
  invalid_phone: "אין מספר טלפון תקין ללקוחה",
  unsubscribed: "הלקוחה הסירה את עצמה מקבלת הודעות",
  cooldown: "נשלחה הודעה ללקוחה לאחרונה (תקופת המתנה)",
  provider_error: "שגיאה מצד ספק ה-WhatsApp",
  no_trigger: "אין טריגר שליחה אוטומטי לסוג הודעה זה",
  unknown: "סיבה לא ידועה",
};

export function whatsAppReasonLabel(code: WhatsAppSendReason): string {
  return WHATSAPP_REASON_LABELS[code] ?? WHATSAPP_REASON_LABELS.unknown;
}
