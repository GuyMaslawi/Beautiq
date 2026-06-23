// Shared pure helpers for the public business page.

export const WEEKDAY_NAMES: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function brandGradient(brand: string): string {
  return `linear-gradient(135deg, ${brand}cc 0%, ${brand} 100%)`;
}

export function normalizeInstagramUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("@")) return `https://instagram.com/${url.slice(1)}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

export function normalizeSocialUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

export function toWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

/**
 * Normalize an Israeli phone into a WhatsApp-ready international number, or
 * return null when the input can't form a valid number. Use this to decide
 * whether to render a WhatsApp action at all (hide instead of linking to a
 * broken/empty wa.me URL).
 *
 *   "050-123 4567"  → "972501234567"
 *   "+972501234567" → "972501234567"
 *   ""/null/garbage → null
 */
export function normalizeWhatsAppPhone(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  const wa = toWhatsAppPhone(phone);
  // Israeli numbers normalize to 972 + 8–9 digits (landline / mobile).
  return /^972\d{8,9}$/.test(wa) ? wa : null;
}

/**
 * Build a wa.me link to the business owner's WhatsApp with an optional
 * prefilled "came from the booking page" message. Returns null when the
 * business has no valid phone, so callers can hide the action.
 *
 * This is the single source of truth for every WhatsApp link on the public
 * page — always points to the business owner, never to support or the
 * customer's own phone.
 */
export function getBusinessWhatsAppHref(
  phone: string | null | undefined,
  businessName?: string | null,
): string | null {
  const wa = normalizeWhatsAppPhone(phone);
  if (!wa) return null;
  const base = `https://wa.me/${wa}`;
  if (!businessName) return base;
  const message = `היי, הגעתי דרך עמוד ההזמנות של ${businessName} ורוצה לברר פרטים`;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
