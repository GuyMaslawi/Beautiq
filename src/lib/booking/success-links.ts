/**
 * Pure helpers for the booking-success confirmation (calendar + WhatsApp deep
 * links, Hebrew date formatting). Shared by the in-form client success view and
 * the server-rendered post-payment success page so both produce identical
 * actions. No secrets, no IDs — only display data passed in by the caller.
 */

/** Normalize an Israeli phone to wa.me digits (972…, no +/spaces). */
export function toWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

/** Format a "YYYY-MM-DD" date as a friendly Hebrew date (e.g. "יום ראשון, 12 בינואר"). */
export function formatDateHebrew(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(y, m - 1, d));
  } catch {
    return dateStr;
  }
}

export interface BookingLinkParams {
  serviceName?: string | null;
  businessName: string;
  /** "YYYY-MM-DD" wall-clock date. */
  date: string;
  /** "HH:MM" wall-clock time. */
  time: string;
  /** Service duration in minutes (defaults to 60 when unknown). */
  durationMinutes?: number | null;
  /** Business phone, if known — message is sent to the business when present. */
  businessPhone?: string | null;
}

/** Build a Google Calendar "add event" URL for the booking. */
export function buildGoogleCalendarUrl(p: BookingLinkParams): string {
  const [y, m, d] = p.date.split("-");
  const [hh, mm] = p.time.split(":");
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const endTotal =
    parseInt(hh, 10) * 60 + parseInt(mm, 10) + (p.durationMinutes ?? 60);
  const endH = Math.floor(endTotal / 60)
    .toString()
    .padStart(2, "0");
  const endM = (endTotal % 60).toString().padStart(2, "0");
  const end = `${y}${m}${d}T${endH}${endM}00`;
  const text = `${p.serviceName ?? "תור"} — ${p.businessName}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    text,
  )}&dates=${start}/${end}`;
}

/** Build a WhatsApp deep link with a prefilled Hebrew message. */
export function buildWhatsAppUrl(p: BookingLinkParams, message?: string): string {
  const text =
    message ??
    `היי! קבעתי תור ל${p.serviceName ?? "טיפול"} אצל ${p.businessName}. ${formatDateHebrew(
      p.date,
    )} בשעה ${p.time} 🎉`;
  const target = p.businessPhone
    ? `https://wa.me/${toWhatsAppPhone(p.businessPhone)}`
    : "https://wa.me/";
  return `${target}?text=${encodeURIComponent(text)}`;
}
