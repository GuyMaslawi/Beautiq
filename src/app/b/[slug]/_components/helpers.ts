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

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
