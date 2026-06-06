/**
 * Israeli phone number utilities.
 *
 * Normalization strips non-digit characters and converts international
 * prefixes (972 / +972) to the local 0-prefix format. The result is
 * used as the unique lookup key on Client.normalizedPhone.
 */

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) {
    digits = "0" + digits.slice(3);
  }
  return digits;
}

/** Basic validity check: 10 digits starting with 0 (Israeli mobile/landline). */
export function isValidIsraeliPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^0\d{8,9}$/.test(normalized);
}
