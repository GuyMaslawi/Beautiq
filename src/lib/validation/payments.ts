/**
 * Validation for business payment settings (owner-facing form).
 *
 * The form sends the deposit amount in SHEKELS; we validate and convert to
 * agorot (minor units) for storage. All errors are Hebrew, user-facing.
 */

import type {
  DepositKind,
  PaymentProviderKind,
  PaymentRequirement,
} from "@prisma/client";
import { PAYMENTS } from "@/lib/constants/he";
import { toMinor } from "@/lib/payments/money";

const PROVIDERS: PaymentProviderKind[] = [
  "mock",
  "payplus",
  "grow_meshulam",
  "tranzila",
  "disabled",
];
const REQUIREMENTS: PaymentRequirement[] = ["none", "deposit", "full_payment"];
const DEPOSIT_TYPES: DepositKind[] = ["fixed_amount", "percentage"];

export interface PaymentSettingsInput {
  enabled: boolean;
  provider: PaymentProviderKind;
  requirement: PaymentRequirement;
  depositType: DepositKind;
  depositAmountMinor: number | null;
  depositPercentage: number | null;
  allowPayAtBusiness: boolean;
  instructions: string | null;
}

export type PaymentSettingsValidation =
  | { ok: true; value: PaymentSettingsInput }
  | { ok: false; errors: Partial<Record<string, string>> };

export function validatePaymentSettings(
  raw: Record<string, string>,
): PaymentSettingsValidation {
  const errors: Partial<Record<string, string>> = {};

  const enabled = raw.enabled === "true";
  const allowPayAtBusiness = raw.allowPayAtBusiness === "true";

  const provider = (PROVIDERS as string[]).includes(raw.provider)
    ? (raw.provider as PaymentProviderKind)
    : "mock";
  const requirement = (REQUIREMENTS as string[]).includes(raw.requirement)
    ? (raw.requirement as PaymentRequirement)
    : "none";
  const depositType = (DEPOSIT_TYPES as string[]).includes(raw.depositType)
    ? (raw.depositType as DepositKind)
    : "fixed_amount";

  let depositAmountMinor: number | null = null;
  let depositPercentage: number | null = null;

  // Deposit amount / percentage are only required when the policy actually
  // requires a deposit. We still parse+validate them so bad values can't slip in.
  if (requirement === "deposit") {
    if (depositType === "fixed_amount") {
      const amount = parseFloat(raw.depositAmount ?? "");
      if (!isFinite(amount) || amount <= 0) {
        errors.depositAmount = PAYMENTS.errors.depositAmountRequired;
      } else {
        depositAmountMinor = toMinor(amount);
      }
    } else {
      const pct = parseInt(raw.depositPercentage ?? "", 10);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        errors.depositPercentage = PAYMENTS.errors.depositPercentageRequired;
      } else {
        depositPercentage = pct;
      }
    }
  } else {
    // Keep whatever was entered (so the form round-trips) but don't require it.
    const amount = parseFloat(raw.depositAmount ?? "");
    if (isFinite(amount) && amount > 0) depositAmountMinor = toMinor(amount);
    const pct = parseInt(raw.depositPercentage ?? "", 10);
    if (Number.isInteger(pct) && pct >= 1 && pct <= 100) depositPercentage = pct;
  }

  const instructions = (raw.instructions ?? "").trim().slice(0, 500) || null;

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      enabled,
      provider,
      requirement,
      depositType,
      depositAmountMinor,
      depositPercentage,
      allowPayAtBusiness,
      instructions,
    },
  };
}
