import { isValidIsraeliPhone } from "@/lib/phone";
import { TEXT_LIMITS, exceedsLimit, tooLongError } from "@/lib/validation/text";
import { SETTINGS } from "@/lib/constants/he";

export type BusinessDetailsField =
  | "name"
  | "phone"
  | "city"
  | "description"
  | "addressNote"
  | "form";

export interface BusinessDetailsInput {
  name: string;
  phone?: string;
  city?: string;
  description?: string;
  addressNote?: string;
}

type BusinessDetailsErrors = Partial<Record<BusinessDetailsField, string>>;

export type BusinessDetailsValidationResult =
  | { ok: true; value: BusinessDetailsInput }
  | { ok: false; errors: BusinessDetailsErrors };

export function validateBusinessDetails(
  raw: Record<string, string>,
): BusinessDetailsValidationResult {
  const errors: BusinessDetailsErrors = {};

  const name = (raw.name ?? "").trim();
  if (!name) errors.name = SETTINGS.errors.nameRequired;

  const phoneRaw = (raw.phone ?? "").trim();
  if (phoneRaw && !isValidIsraeliPhone(phoneRaw)) {
    errors.phone = SETTINGS.errors.phoneInvalid;
  }

  // תקרות אורך. העמודות האלה הן `text` ללא תקרה משלהן, והערכים מוצגים
  // בעמוד הציבורי ובכותרות באפליקציה — בלי גבול אפשר לשמור מגה-בייטים
  // בשדה יחיד ולהאט את כל המסכים שמציגים אותו.
  const limits: Array<[BusinessDetailsField, string, number]> = [
    ["name", name, TEXT_LIMITS.name],
    ["city", (raw.city ?? "").trim(), TEXT_LIMITS.short],
    ["description", (raw.description ?? "").trim(), TEXT_LIMITS.paragraph],
    ["addressNote", (raw.addressNote ?? "").trim(), TEXT_LIMITS.short],
  ];
  for (const [field, value, limit] of limits) {
    if (exceedsLimit(value, limit)) errors[field] = tooLongError(limit);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      phone: phoneRaw || undefined,
      city: (raw.city ?? "").trim() || undefined,
      description: (raw.description ?? "").trim() || undefined,
      addressNote: (raw.addressNote ?? "").trim() || undefined,
    },
  };
}
