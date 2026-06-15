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

export type CancellationPolicyField =
  | "minNoticeHours"
  | "lateCancellationHours"
  | "lateCancellationFeeAmount"
  | "lateCancellationFeePercentage"
  | "form";

export interface CancellationPolicyInput {
  enabled: boolean;
  policyText?: string;
  minNoticeHours?: number;
  lateCancellationHours?: number;
  lateCancellationFeeType: string;
  lateCancellationFeeAmount?: number;
  lateCancellationFeePercentage?: number;
}

type CancellationPolicyErrors = Partial<Record<CancellationPolicyField, string>>;

export type CancellationPolicyValidationResult =
  | { ok: true; value: CancellationPolicyInput }
  | { ok: false; errors: CancellationPolicyErrors };

export function validateCancellationPolicy(
  raw: Record<string, string>,
): CancellationPolicyValidationResult {
  const errors: CancellationPolicyErrors = {};

  const minNoticeRaw = (raw.minNoticeHours ?? "").trim();
  let minNoticeHours: number | undefined;
  if (minNoticeRaw) {
    const parsed = parseInt(minNoticeRaw, 10);
    if (isNaN(parsed) || parsed < 0) {
      errors.minNoticeHours = SETTINGS.errors.minNoticeInvalid;
    } else {
      minNoticeHours = parsed;
    }
  }

  const lateHoursRaw = (raw.lateCancellationHours ?? "").trim();
  let lateCancellationHours: number | undefined;
  if (lateHoursRaw) {
    const parsed = parseInt(lateHoursRaw, 10);
    if (isNaN(parsed) || parsed < 1) {
      errors.lateCancellationHours = SETTINGS.errors.minNoticeInvalid;
    } else {
      lateCancellationHours = parsed;
    }
  }

  const feeType = (raw.lateCancellationFeeType ?? "none").trim();

  let lateCancellationFeeAmount: number | undefined;
  if (feeType === "fixed") {
    const amtRaw = (raw.lateCancellationFeeAmount ?? "").trim();
    if (amtRaw) {
      const parsed = parseFloat(amtRaw);
      if (isNaN(parsed) || parsed < 0) {
        errors.lateCancellationFeeAmount = SETTINGS.errors.minNoticeInvalid;
      } else {
        lateCancellationFeeAmount = parsed;
      }
    }
  }

  let lateCancellationFeePercentage: number | undefined;
  if (feeType === "percentage") {
    const pctRaw = (raw.lateCancellationFeePercentage ?? "").trim();
    if (pctRaw) {
      const parsed = parseFloat(pctRaw);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        errors.lateCancellationFeePercentage = SETTINGS.errors.minNoticeInvalid;
      } else {
        lateCancellationFeePercentage = parsed;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      enabled: raw.enabled === "true",
      policyText: (raw.policyText ?? "").trim() || undefined,
      minNoticeHours,
      lateCancellationHours,
      lateCancellationFeeType: feeType,
      lateCancellationFeeAmount,
      lateCancellationFeePercentage,
    },
  };
}
