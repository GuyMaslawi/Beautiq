import { normalizePhone, isValidIsraeliPhone } from "@/lib/phone";

/**
 * Converts a normalized local Israeli phone (e.g. "0501234567") to the
 * international format required by wa.me (e.g. "972501234567").
 */
function toWhatsAppNumber(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized.startsWith("0") ? "972" + normalized.slice(1) : normalized;
}

/**
 * Returns a wa.me deep-link URL with the message pre-filled, or null if the
 * phone number cannot be recognized as a valid Israeli number.
 */
export function buildWhatsAppUrl(phone: string, message: string): string | null {
  if (!phone || !isValidIsraeliPhone(phone)) return null;
  const intl = toWhatsAppNumber(phone);
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
