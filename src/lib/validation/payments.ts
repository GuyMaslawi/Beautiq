/**
 * Validation for business payment settings (owner-facing form).
 *
 * Allura supports only "no payment" or "full online payment" (plus an optional
 * "pay at the business" escape hatch) — there are no deposits / partial
 * payments. All errors are Hebrew, user-facing.
 */

import type {
  PaymentProviderKind,
  PaymentRequirement,
} from "@prisma/client";

const PROVIDERS: PaymentProviderKind[] = [
  "mock",
  "payplus",
  "grow_meshulam",
  "tranzila",
  "disabled",
];
const REQUIREMENTS: PaymentRequirement[] = ["none", "full_payment"];

export interface PaymentSettingsInput {
  enabled: boolean;
  provider: PaymentProviderKind;
  requirement: PaymentRequirement;
  allowPayAtBusiness: boolean;
  instructions: string | null;
}

export type PaymentSettingsValidation =
  | { ok: true; value: PaymentSettingsInput }
  | { ok: false; errors: Partial<Record<string, string>> };

export function validatePaymentSettings(
  raw: Record<string, string>,
): PaymentSettingsValidation {
  const enabled = raw.enabled === "true";
  const allowPayAtBusiness = raw.allowPayAtBusiness === "true";

  const provider = (PROVIDERS as string[]).includes(raw.provider)
    ? (raw.provider as PaymentProviderKind)
    : "mock";
  const requirement = (REQUIREMENTS as string[]).includes(raw.requirement)
    ? (raw.requirement as PaymentRequirement)
    : "none";

  const instructions = (raw.instructions ?? "").trim().slice(0, 500) || null;

  return {
    ok: true,
    value: {
      enabled,
      provider,
      requirement,
      allowPayAtBusiness,
      instructions,
    },
  };
}
