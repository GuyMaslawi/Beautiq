/**
 * Money helpers for booking payments.
 *
 * Booking payments are stored in MINOR units (agorot, integers). Service
 * prices elsewhere are Decimal(10,2) in major units (shekels). These helpers
 * convert at the boundary and compute the amount to collect from a business's
 * payment policy.
 */

import type { PaymentRequirement } from "@prisma/client";

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
}

export interface ComputedAmount {
  /** Amount to collect online, in agorot. 0 when no payment is required. */
  amountMinor: number;
  /** What the amount represents — drives the public-step copy. */
  kind: "none" | "full";
}

/**
 * Compute the amount to collect for a booking given the business policy and
 * the service price (in agorot). Pure & deterministic — safe to unit test.
 *
 * Allura supports only full online payment (the full service price) or no
 * payment at all — there are no deposits / partial payments.
 */
export function computePaymentAmount(
  policy: PaymentPolicy,
  servicePriceMinor: number,
): ComputedAmount {
  const price = Math.max(0, Math.round(servicePriceMinor));

  if (policy.requirement === "full_payment") {
    return { amountMinor: price, kind: "full" };
  }

  return { amountMinor: 0, kind: "none" };
}
