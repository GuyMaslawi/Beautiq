import { isValidIsraeliPhone } from "@/lib/phone";
import { SETTINGS } from "@/lib/constants/he";

export type BusinessDetailsField = "name" | "phone" | "form";

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
