/**
 * Israeli phone number utilities.
 *
 * Normalizes any reasonable Israeli phone input to E.164 (+972XXXXXXXXX).
 * The result is stored in Client.normalizedPhone and used as the unique
 * lookup key and the number sent to WhatsApp providers.
 *
 * Supported inputs:
 *   0501234567  |  050-123-4567  |  050 123 4567
 *   +972501234567  |  972501234567
 *
 * Output: +972501234567
 */

/** Returns E.164 representation, or a best-effort string for invalid input. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Strip country code prefix (972 or +972 already stripped by /\D/)
  if (digits.startsWith("972")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return "+972" + digits;
}

/**
 * Validates that a phone (raw or already normalized) is a reachable Israeli
 * mobile or landline number.
 *
 * After normalization the number must be +972 followed by 8 or 9 digits
 * (matching 9–10 digit local numbers).
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+972\d{8,9}$/.test(normalized);
}

/**
 * Canonical recipient format for the Meta WhatsApp Cloud API: E.164 digits
 * WITHOUT the leading '+' (e.g. 972501234567).
 *
 * IMPORTANT: every send path must use this single helper so the recipient
 * format is identical everywhere. Previously several callers used ad-hoc
 * conversions that produced inconsistent formats (some with '+', some without),
 * which broke the test-mode recipient comparison — see {@link phonesEqual}.
 */
export function toWaPhone(phone: string): string {
  return normalizePhone(phone).replace(/^\+/, "");
}

/**
 * Format-agnostic phone equality. Compares two phone numbers by their
 * normalized E.164 form so "+972544961155", "972544961155", "0544961155" and
 * "054-496-1155" are all treated as the same number.
 *
 * Used by the test-mode guard to compare a recipient against WHATSAPP_TEST_PHONE
 * regardless of which format each side happens to be in.
 */
export function phonesEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizePhone(a) === normalizePhone(b);
}
