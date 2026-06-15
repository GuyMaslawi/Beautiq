/**
 * Payment settings queries — owner-facing and public-safe.
 *
 * Public-safe getters NEVER return provider credentials. All queries are
 * scoped by businessId.
 */

import type {
  BookingPaymentStatus,
  PaymentProviderKind,
  PaymentRequirement,
} from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export interface PaymentSettingsData {
  enabled: boolean;
  provider: PaymentProviderKind;
  requirement: PaymentRequirement;
  allowPayAtBusiness: boolean;
  instructions: string;
}

const DEFAULT_SETTINGS: PaymentSettingsData = {
  enabled: false,
  provider: "mock",
  requirement: "none",
  allowPayAtBusiness: true,
  instructions: "",
};

/** Owner-facing settings for the form. Returns sensible defaults if unset. */
export async function getPaymentSettings(
  businessId: string,
): Promise<PaymentSettingsData> {
  const row = await prisma.businessPaymentSettings.findUnique({
    where: { businessId },
  });
  if (!row) return { ...DEFAULT_SETTINGS };

  return {
    enabled: row.enabled,
    provider: row.provider,
    requirement: row.requirement,
    allowPayAtBusiness: row.allowPayAtBusiness,
    instructions: row.instructions ?? "",
  };
}

export interface PublicPaymentPolicy {
  requirement: PaymentRequirement;
  allowPayAtBusiness: boolean;
  instructions: string | null;
  provider: PaymentProviderKind;
}

/**
 * Public-safe payment policy for the booking page. Returns null when payments
 * are disabled or settings don't require any payment — caller then keeps the
 * existing no-payment flow. NEVER includes credentials.
 */
export async function getPublicPaymentPolicy(
  businessId: string,
): Promise<PublicPaymentPolicy | null> {
  const row = await prisma.businessPaymentSettings.findUnique({
    where: { businessId },
    select: {
      enabled: true,
      requirement: true,
      allowPayAtBusiness: true,
      instructions: true,
      provider: true,
    },
  });

  if (!row || !row.enabled) return null;
  // Online payment is only surfaced when a full payment is required.
  // `allowPayAtBusiness` then acts as a "pay at the business instead" escape
  // hatch shown alongside the secure-payment CTA.
  if (row.requirement === "none") return null;

  return {
    requirement: row.requirement,
    allowPayAtBusiness: row.allowPayAtBusiness,
    instructions: row.instructions,
    provider: row.provider,
  };
}

export interface BookingPaymentSummary {
  status: BookingPaymentStatus;
  amountMinor: number;
  paymentUrl: string | null;
}

/** Owner-facing booking payment summary, scoped by businessId. */
export async function getBookingPaymentForBooking(
  businessId: string,
  bookingId: string,
): Promise<BookingPaymentSummary | null> {
  const row = await prisma.bookingPayment.findFirst({
    where: { businessId, bookingId },
    select: { status: true, amountMinor: true, paymentUrl: true },
  });
  return row;
}
