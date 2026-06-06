import type { BusinessCategoryKey } from "@prisma/client";
import { SERVICES } from "@/lib/constants/he";

export type ServiceField =
  | "name"
  | "durationMinutes"
  | "price"
  | "depositAmount"
  | "bufferBeforeMinutes"
  | "bufferAfterMinutes"
  | "form";

export interface ServiceInput {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  requiresDeposit: boolean;
  depositAmount?: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  categoryKey?: BusinessCategoryKey;
}

type FieldErrors = Partial<Record<ServiceField, string>>;

export type ServiceValidationResult =
  | { ok: true; value: ServiceInput }
  | { ok: false; errors: FieldErrors };

const VALID_CATEGORY_KEYS = new Set<string>([
  "nails",
  "brows",
  "lashes",
  "hair",
  "makeup",
  "cosmetics",
  "laser",
  "aesthetics",
  "massage",
  "spa",
  "permanent_makeup",
  "other",
]);

export function validateService(
  raw: Record<string, string>,
): ServiceValidationResult {
  const errors: FieldErrors = {};

  const name = (raw.name ?? "").trim();
  if (!name) errors.name = SERVICES.errors.nameRequired;

  const durationRaw = (raw.durationMinutes ?? "").trim();
  const durationMinutes = parseInt(durationRaw, 10);
  if (!durationRaw) {
    errors.durationMinutes = SERVICES.errors.durationRequired;
  } else if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    errors.durationMinutes = SERVICES.errors.durationInvalid;
  }

  const priceRaw = (raw.price ?? "").trim();
  const price = parseFloat(priceRaw);
  if (!priceRaw) {
    errors.price = SERVICES.errors.priceRequired;
  } else if (isNaN(price) || price < 0) {
    errors.price = SERVICES.errors.priceInvalid;
  }

  // checkbox sends "true" when checked, nothing when unchecked
  const requiresDeposit =
    raw.requiresDeposit === "true" || raw.requiresDeposit === "on";
  let depositAmount: number | undefined;

  if (requiresDeposit) {
    const depositRaw = (raw.depositAmount ?? "").trim();
    depositAmount = parseFloat(depositRaw);
    if (!depositRaw) {
      errors.depositAmount = SERVICES.errors.depositAmountRequired;
    } else if (isNaN(depositAmount) || depositAmount < 0) {
      errors.depositAmount = SERVICES.errors.depositAmountInvalid;
    } else if (!errors.price && !isNaN(price) && depositAmount > price) {
      errors.depositAmount = SERVICES.errors.depositHigherThanPrice;
    }
  }

  const bufferBeforeRaw = (raw.bufferBeforeMinutes ?? "0").trim();
  const bufferBeforeMinutes = parseInt(bufferBeforeRaw, 10);
  if (bufferBeforeRaw && (isNaN(bufferBeforeMinutes) || bufferBeforeMinutes < 0)) {
    errors.bufferBeforeMinutes = SERVICES.errors.bufferInvalid;
  }

  const bufferAfterRaw = (raw.bufferAfterMinutes ?? "0").trim();
  const bufferAfterMinutes = parseInt(bufferAfterRaw, 10);
  if (bufferAfterRaw && (isNaN(bufferAfterMinutes) || bufferAfterMinutes < 0)) {
    errors.bufferAfterMinutes = SERVICES.errors.bufferInvalid;
  }

  let categoryKey: BusinessCategoryKey | undefined;
  const catRaw = (raw.categoryKey ?? "").trim();
  if (catRaw && VALID_CATEGORY_KEYS.has(catRaw)) {
    categoryKey = catRaw as BusinessCategoryKey;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      description: (raw.description ?? "").trim() || undefined,
      durationMinutes,
      price,
      requiresDeposit,
      depositAmount: requiresDeposit ? depositAmount : undefined,
      bufferBeforeMinutes: isNaN(bufferBeforeMinutes) ? 0 : bufferBeforeMinutes,
      bufferAfterMinutes: isNaN(bufferAfterMinutes) ? 0 : bufferAfterMinutes,
      categoryKey,
    },
  };
}
