/**
 * Money helpers for booking payments.
 *
 * Booking payments are stored in MINOR units (agorot, integers). Service
 * prices elsewhere are Decimal(10,2) in major units (shekels). These helpers
 * convert at the boundary and compute the amount to collect from a business's
 * payment policy.
 */

import type {
  DepositKind,
  PaymentRequirement,
} from "@prisma/client";

/** Convert a shekel amount (number or Prisma.Decimal-like) to agorot (integer). */
export function toMinor(major: number | string): number {
  const n = typeof major === "string" ? parseFloat(major) : major;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convert agorot to shekels (number, 2 decimals). */
export function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Format agorot as a Hebrew ILS string, e.g. 15000 → "₪150". */
export function formatMinorILS(minor: number): string {
  const major = toMajor(minor);
  const formatted = Number.isInteger(major)
    ? major.toLocaleString("he-IL")
    : major.toLocaleString("he-IL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `₪${formatted}`;
}

export interface PaymentPolicy {
  requirement: PaymentRequirement;
  depositType: DepositKind;
  depositAmountMinor: number | null;
  depositPercentage: number | null;
}

export interface ComputedAmount {
  /** Amount to collect online, in agorot. 0 when no payment is required. */
  amountMinor: number;
  /** What the amount represents — drives the public-step copy. */
  kind: "none" | "deposit" | "full";
}

/**
 * Compute the amount to collect for a booking given the business policy and
 * the service price (in agorot). Pure & deterministic — safe to unit test.
 *
 * Deposits are clamped to never exceed the full price and never go below 0.
 */
export function computePaymentAmount(
  policy: PaymentPolicy,
  servicePriceMinor: number,
): ComputedAmount {
  const price = Math.max(0, Math.round(servicePriceMinor));

  if (policy.requirement === "none") {
    return { amountMinor: 0, kind: "none" };
  }

  if (policy.requirement === "full_payment") {
    return { amountMinor: price, kind: "full" };
  }

  // requirement === "deposit"
  let deposit: number;
  if (policy.depositType === "percentage") {
    const pct = policy.depositPercentage ?? 0;
    deposit = Math.round((price * pct) / 100);
  } else {
    deposit = policy.depositAmountMinor ?? 0;
  }

  // A deposit larger than the price makes no sense — clamp to the full price.
  deposit = Math.max(0, Math.min(deposit, price));
  return { amountMinor: deposit, kind: "deposit" };
}
