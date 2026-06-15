/**
 * Core booking-payment service.
 *
 * Shared by the public booking flow (create a hosted payment link) and the
 * webhook handler (apply a verified provider event). All writes are scoped by
 * businessId. A booking is NEVER auto-confirmed here — the booking stays
 * `pending`; only the money state (the BookingPayment record) changes.
 *
 * Server-only.
 */

import type { BookingPaymentStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { resolvePaymentProviderForBusiness } from "./resolver";
import type { ParsedWebhookEvent } from "@/lib/payments/provider";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export interface CreateBookingPaymentParams {
  businessId: string;
  bookingId: string;
  clientId: string | null;
  amountMinor: number;
  customerName: string;
  customerPhone: string;
  description: string;
}

export interface CreateBookingPaymentResult {
  ok: boolean;
  paymentUrl: string | null;
  status: BookingPaymentStatus;
  bookingPaymentId: string | null;
}

/**
 * Create (or reuse) a BookingPayment for a booking and generate a hosted
 * payment link via the business's resolved provider. Idempotent on bookingId
 * (bookingId is unique): a second call returns the existing link.
 *
 * Returns ok:false (never throws) so the public flow can degrade gracefully —
 * the booking already exists as `pending` regardless.
 */
export async function createBookingPayment(
  params: CreateBookingPaymentParams,
): Promise<CreateBookingPaymentResult> {
  if (params.amountMinor <= 0) {
    return { ok: false, paymentUrl: null, status: "failed", bookingPaymentId: null };
  }

  const resolved = await resolvePaymentProviderForBusiness(params.businessId);

  // Reuse an existing record if one is already there (idempotent).
  const existing = await prisma.bookingPayment.findUnique({
    where: { bookingId: params.bookingId },
  });

  if (existing && existing.paymentUrl && existing.status === "payment_link_created") {
    return {
      ok: true,
      paymentUrl: existing.paymentUrl,
      status: existing.status,
      bookingPaymentId: existing.id,
    };
  }

  const record =
    existing ??
    (await prisma.bookingPayment.create({
      data: {
        businessId: params.businessId,
        bookingId: params.bookingId,
        clientId: params.clientId,
        provider: resolved.configuredProvider,
        status: "pending",
        amountMinor: params.amountMinor,
        currency: "ILS",
      },
    }));

  const base = appBaseUrl();
  try {
    const link = await resolved.provider.createPaymentLink({
      businessId: params.businessId,
      bookingPaymentId: record.id,
      amountMinor: params.amountMinor,
      currency: "ILS",
      description: params.description,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      returnSuccessUrl: `${base}/api/payments/return/success?bp=${record.id}`,
      returnFailureUrl: `${base}/api/payments/return/failure?bp=${record.id}`,
      webhookUrl: `${base}/api/payments/${resolved.provider.name}/webhook`,
    });

    const updated = await prisma.bookingPayment.update({
      where: { id: record.id },
      data: {
        status: "payment_link_created",
        paymentUrl: link.paymentUrl,
        providerTransactionId: link.providerTransactionId,
        expiresAt: link.expiresAt ?? null,
        providerPayloadJson: link.metadata
          ? (link.metadata as object)
          : undefined,
      },
    });

    return {
      ok: true,
      paymentUrl: updated.paymentUrl,
      status: updated.status,
      bookingPaymentId: updated.id,
    };
  } catch (err) {
    console.error("[createBookingPayment] link creation failed:", err);
    await prisma.bookingPayment
      .update({
        where: { id: record.id },
        data: { status: "failed", failedAt: new Date() },
      })
      .catch(() => {});
    return { ok: false, paymentUrl: null, status: "failed", bookingPaymentId: record.id };
  }
}

/**
 * Apply a verified webhook event idempotently. Confirmation of payment comes
 * ONLY from here (a verified provider event) — never from a client redirect.
 *
 * Idempotency: keyed on providerTransactionId (unique). Re-delivery of the
 * same terminal status is a no-op and never double-confirms a booking.
 */
export async function applyPaymentWebhookEvent(
  event: ParsedWebhookEvent,
): Promise<{ applied: boolean; reason?: string }> {
  const payment = await prisma.bookingPayment.findUnique({
    where: { providerTransactionId: event.providerTransactionId },
  });

  if (!payment) {
    return { applied: false, reason: "unknown_transaction" };
  }

  // Already in a terminal state — idempotent no-op.
  const TERMINAL: BookingPaymentStatus[] = [
    "paid",
    "failed",
    "cancelled",
    "expired",
    "refunded",
  ];
  if (TERMINAL.includes(payment.status)) {
    return { applied: false, reason: "already_terminal" };
  }

  if (event.status === "paid") {
    // The BookingPayment record is the authoritative money state. The booking
    // stays `pending` (awaiting owner approval) — we never auto-confirm.
    await prisma.bookingPayment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paidAt: event.paidAt ?? new Date(),
        providerPayloadJson: event.raw as object,
      },
    });
    return { applied: true };
  }

  // failed / cancelled / expired
  const nextStatus: BookingPaymentStatus =
    event.status === "cancelled"
      ? "cancelled"
      : event.status === "expired"
        ? "expired"
        : "failed";

  await prisma.bookingPayment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      failedAt: new Date(),
      providerPayloadJson: event.raw as object,
    },
  });
  return { applied: true };
}
