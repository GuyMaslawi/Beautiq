import { isValidIsraeliPhone } from "@/lib/phone";
import { isValidDateStr, isValidTimeStr } from "@/lib/time";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

export interface PublicBookingInput {
  serviceId: string;
  clientName: string;
  phone: string;
  date: string;
  requestedTime: string;
  note: string;
}

type FieldErrors = Partial<Record<keyof PublicBookingInput, string>>;

export type PublicBookingValidationResult =
  | { ok: true; value: PublicBookingInput }
  | { ok: false; errors: FieldErrors };

/**
 * הטופס הציבורי פתוח לכל אדם אנונימי, ולכן חייב גבולות מפורשים: בלי תקרת
 * אורך אפשר לשמור מגה-בייטים של טקסט בכל בקשת תור, ובלי הסרת תווי בקרה
 * אפשר להזריק שורות חדשות לתוך הודעות WhatsApp ולתבניות האימייל לבעלת העסק.
 */
const MAX_CLIENT_NAME = 80;
const MAX_NOTE = 500;

/** מסיר תווי בקרה (שורה חדשה, טאב וכו') ומכווץ רווחים — טקסט חד-שורתי נקי. */
function stripControlChars(value: string): string {
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function validatePublicBooking(
  raw: Record<string, string>,
): PublicBookingValidationResult {
  const errors: FieldErrors = {};

  const serviceId = (raw.serviceId ?? "").trim();
  if (!serviceId) errors.serviceId = PUBLIC_BOOKING.errors.serviceRequired;

  const clientName = stripControlChars(raw.clientName ?? "");
  if (!clientName) {
    errors.clientName = PUBLIC_BOOKING.errors.clientNameRequired;
  } else if (clientName.length > MAX_CLIENT_NAME) {
    errors.clientName = PUBLIC_BOOKING.errors.clientNameTooLong;
  }

  const phone = (raw.phone ?? "").trim();
  if (!phone) {
    errors.phone = PUBLIC_BOOKING.errors.phoneRequired;
  } else if (!isValidIsraeliPhone(phone)) {
    errors.phone = PUBLIC_BOOKING.errors.phoneInvalid;
  }

  // Both come from client-controlled hidden inputs, so validate the exact
  // format — otherwise garbage flows into the date parser, produces NaN/rolled-
  // over times, and silently bypasses the past-time guard in the action.
  // בדיקת צורה בלבד אינה מספיקה: `/^\d{4}-\d{2}-\d{2}$/` מקבל גם "2026-99-99",
  // ו-Date.UTC מגלגל את החריגה קדימה בשקט (התאריך הזה נוחת ב-2034). לכן
  // isValidDateStr מאמת מול לוח השנה האמיתי ולא רק מול תבנית.
  const date = (raw.date ?? "").trim();
  if (!date) {
    errors.date = PUBLIC_BOOKING.errors.dateRequired;
  } else if (!isValidDateStr(date)) {
    errors.date = PUBLIC_BOOKING.errors.dateRequired;
  }

  const requestedTime = (raw.requestedTime ?? "").trim();
  if (!requestedTime) {
    errors.requestedTime = PUBLIC_BOOKING.errors.timeRequired;
  } else if (!isValidTimeStr(requestedTime)) {
    errors.requestedTime = PUBLIC_BOOKING.errors.timeRequired;
  }

  const note = stripControlChars(raw.note ?? "");
  if (note.length > MAX_NOTE) {
    errors.note = PUBLIC_BOOKING.errors.noteTooLong;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { serviceId, clientName, phone, date, requestedTime, note },
  };
}
