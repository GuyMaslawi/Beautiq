import { isValidIsraeliPhone } from "@/lib/phone";
import { isValidDateStr, isValidTimeStr } from "@/lib/time";
import { BOOKINGS } from "@/lib/constants/he";

export interface BookingInput {
  clientName: string;
  phone: string;
  serviceId: string;
  date: string;
  startTime: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof BookingInput, string>>;

export type BookingValidationResult =
  | { ok: true; value: BookingInput }
  | { ok: false; errors: FieldErrors };

/**
 * גבולות טקסט. השם והערה נכנסים להודעות WhatsApp ולאימיילים שנשלחים בפועל,
 * ונשמרים בעמודות ללא תקרה משלהן.
 */
const MAX_CLIENT_NAME = 80;
/** מיוצא כדי שהטופס יוכל לרמז על אותו גבול (maxLength) — האכיפה היא בשרת. */
export const MAX_BOOKING_NOTES = 1000;
const MAX_NOTES = MAX_BOOKING_NOTES;

/** מסיר תווי בקרה (שורה חדשה, טאב) ומכווץ רווחים — טקסט חד-שורתי נקי. */
function stripControlChars(value: string): string {
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function validateBooking(
  raw: Record<string, string>,
): BookingValidationResult {
  const errors: FieldErrors = {};

  // שם הלקוחה מגיע כטקסט חופשי ומשם ממשיך אל תבנית ה-WhatsApp ואל האימייל
  // לבעלת העסק. בלי ניקוי תווי בקרה אפשר להזריק שורות חדשות לתוך הודעה
  // אמיתית, ובלי תקרת אורך אפשר לשמור מגה-בייטים בעמודה אחת.
  const clientName = stripControlChars(raw.clientName ?? "");
  if (!clientName) {
    errors.clientName = BOOKINGS.errors.clientNameRequired;
  } else if (clientName.length > MAX_CLIENT_NAME) {
    errors.clientName = BOOKINGS.errors.clientNameTooLong;
  }

  const phone = (raw.phone ?? "").trim();
  if (!phone) {
    errors.phone = BOOKINGS.errors.phoneRequired;
  } else if (!isValidIsraeliPhone(phone)) {
    errors.phone = BOOKINGS.errors.phoneInvalid;
  }

  const serviceId = (raw.serviceId ?? "").trim();
  if (!serviceId) errors.serviceId = BOOKINGS.errors.serviceRequired;

  // התאריך והשעה נשלחים משדות טופס בשליטת הדפדפן ונמסרים ישירות למנתח
  // התאריכים. עד עכשיו נבדק רק שהם אינם ריקים, ולכן ערך כמו "abc" הפיל את
  // הבקשה כולה (RangeError מתוך Intl), וערך כמו "2026-99-99" "התגלגל" בשקט
  // לשנת 2034 — כלומר תור נוצר בתאריך אחר לגמרי מזה שנשלח, אחרי שעבר את
  // בדיקת "לא בעבר". שתי הבדיקות כאן סוגרות את שניהם.
  const date = (raw.date ?? "").trim();
  if (!date) {
    errors.date = BOOKINGS.errors.dateRequired;
  } else if (!isValidDateStr(date)) {
    errors.date = BOOKINGS.errors.dateInvalid;
  }

  const startTime = (raw.startTime ?? "").trim();
  if (!startTime) {
    errors.startTime = BOOKINGS.errors.startTimeRequired;
  } else if (!isValidTimeStr(startTime)) {
    errors.startTime = BOOKINGS.errors.startTimeInvalid;
  }

  const notes = (raw.notes ?? "").trim();
  if (notes.length > MAX_NOTES) errors.notes = BOOKINGS.errors.notesTooLong;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { clientName, phone, serviceId, date, startTime, notes },
  };
}
