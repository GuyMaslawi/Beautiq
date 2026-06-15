"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
import { hasOverlap } from "@/server/bookings/queries";
import { validatePublicBooking } from "@/lib/validation/public-booking";
import { parseIsraelDateTime } from "@/lib/time";
import { PUBLIC_BOOKING } from "@/lib/constants/he";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPublicPaymentPolicy } from "@/server/payments/settings";
import { createBookingPayment } from "@/server/payments/booking-payment";
import { computePaymentAmount } from "@/lib/payments/money";
import { sendBookingConfirmation } from "./send-confirmation";

const BOOKING_RATE_WINDOW_MS = 10 * 60_000; // 10 minutes
const BOOKING_RATE_MAX = 5; // max 5 booking attempts per IP per business per 10 min

const REVIEW_RATE_WINDOW_MS = 10 * 60_000;
const REVIEW_RATE_MAX = 5;

export interface PublicBookingFormState {
  success?: boolean;
  errors?: Partial<Record<string, string>>;
  formError?: string;
  values?: Record<string, string>;
  /** Hosted payment page URL — present only when an online payment is required. */
  paymentUrl?: string;
  /** "full" — what the requested payment represents. */
  paymentKind?: "full";
  /** Amount to collect, in agorot. */
  paymentAmountMinor?: number;
  /** Whether the customer may choose to pay at the business instead. */
  payAtBusinessAllowed?: boolean;
  /** True when payment is required but the link could not be created. */
  paymentLinkFailed?: boolean;
}

/**
 * Public booking request action. The `slug` param is bound server-side at
 * the call site — businessId is always derived from the slug here, never
 * accepted from client input.
 */
export async function submitPublicBookingAction(
  slug: string,
  _prevState: PublicBookingFormState,
  formData: FormData,
): Promise<PublicBookingFormState> {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);
  if (!checkRateLimit(`booking:${ip}:${slug}`, BOOKING_RATE_MAX, BOOKING_RATE_WINDOW_MS)) {
    return { formError: "נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות." };
  }

  const raw: Record<string, string> = {
    serviceId: String(formData.get("serviceId") ?? ""),
    clientName: String(formData.get("clientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    date: String(formData.get("date") ?? ""),
    requestedTime: String(formData.get("requestedTime") ?? ""),
    note: String(formData.get("note") ?? ""),
  };

  const result = validatePublicBooking(raw);
  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

  // Derive businessId server-side — never accept it from client input
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });

  if (!business) return { formError: PUBLIC_BOOKING.errors.generic };

  const tenant = { businessId: business.id };

  // Verify service belongs to this business and is active
  const service = await prisma.service.findFirst({
    where: {
      id: value.serviceId,
      businessId: tenant.businessId,
      isActive: true,
    },
  });

  if (!service) {
    return {
      errors: { serviceId: PUBLIC_BOOKING.errors.serviceUnavailable },
      values: raw,
    };
  }

  const startTime = parseIsraelDateTime(value.date, value.requestedTime);

  // Reject times in the past (5 min tolerance)
  if (startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    return {
      errors: { date: PUBLIC_BOOKING.errors.pastBooking },
      values: raw,
    };
  }

  const totalMinutes =
    service.durationMinutes +
    service.bufferBeforeMinutes +
    service.bufferAfterMinutes;
  const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);

  // Overlap check against existing pending/approved bookings
  const overlaps = await hasOverlap(tenant, startTime, endTime);
  if (overlaps) {
    return {
      errors: { date: PUBLIC_BOOKING.errors.overlap },
      values: raw,
    };
  }

  const client = await findOrCreateClient(tenant, {
    fullName: value.clientName,
    phone: value.phone,
  });

  let newBookingId: string;
  try {
    const booking = await prisma.booking.create({
      data: {
        businessId: tenant.businessId,
        clientId: client.id,
        serviceId: service.id,
        startTime,
        endTime,
        status: "pending",
        source: "public",
        priceSnapshot: new Prisma.Decimal(service.price),
        durationMinutesSnapshot: service.durationMinutes,
        notes: value.note || null,
      },
    });
    newBookingId = booking.id;
  } catch {
    return { formError: PUBLIC_BOOKING.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

  // ── Online payment (full) ─────────────────────────────────────────────────
  // The booking is already created as `pending` (never auto-confirmed). If the
  // business requires full online payment, create a hosted payment link now and
  // return it so the customer can pay on the provider's secure page. Payment is
  // only ever confirmed via a verified provider webhook — never a client redirect.
  let paymentState: Partial<PublicBookingFormState> = {};
  try {
    const policy = await getPublicPaymentPolicy(tenant.businessId);
    if (policy) {
      const { amountMinor, kind } = computePaymentAmount(
        policy,
        Math.round(Number(service.price) * 100),
      );
      if (amountMinor > 0 && kind === "full") {
        const payment = await createBookingPayment({
          businessId: tenant.businessId,
          bookingId: newBookingId,
          clientId: client.id,
          amountMinor,
          customerName: value.clientName,
          customerPhone: value.phone,
          description: `${service.name} · ${business.name}`,
        });
        paymentState = {
          paymentKind: kind,
          paymentAmountMinor: amountMinor,
          payAtBusinessAllowed: policy.allowPayAtBusiness,
          paymentUrl: payment.ok ? (payment.paymentUrl ?? undefined) : undefined,
          paymentLinkFailed: !payment.ok,
        };
      }
    }
  } catch (err) {
    console.error("[submitPublicBookingAction] payment setup failed:", err);
  }

  // Best-effort WhatsApp confirmation — never blocks the response
  sendBookingConfirmation({
    bookingId: newBookingId,
    businessId: tenant.businessId,
    businessName: business.name,
    clientId: client.id,
    clientPhone: value.phone,
    clientName: value.clientName,
    serviceName: service.name,
    startTime,
  }).catch((err) =>
    console.error("[submitPublicBookingAction] WA confirmation failed:", err),
  );

  // Pay-first flow: when an online payment is required and a hosted link was
  // created, send the customer straight to the secure payment page. The
  // booking-success screen ("התור נקבע בהצלחה") is shown only AFTER payment
  // completes, on the return status page (/pay/status). `redirect` throws, so
  // it must stay outside any try/catch.
  if (paymentState.paymentUrl) {
    redirect(paymentState.paymentUrl);
  }

  // Otherwise (no payment required, or the link could not be created) show the
  // in-form confirmation — including a graceful fallback when the link failed.
  return { success: true, ...paymentState };
}

// ---------------------------------------------------------------------------
// Public review submission (no auth — customer-facing)
// ---------------------------------------------------------------------------

export interface PublicReviewFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: boolean;
}

export async function submitPublicReviewAction(
  slug: string,
  _prev: PublicReviewFormState,
  formData: FormData,
): Promise<PublicReviewFormState> {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);
  if (!checkRateLimit(`review:${ip}:${slug}`, REVIEW_RATE_MAX, REVIEW_RATE_WINDOW_MS)) {
    return { formError: "נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות." };
  }

  const clientName = String(formData.get("clientName") ?? "").trim();
  const reviewText = String(formData.get("reviewText") ?? "").trim();
  const ratingRaw = parseInt(String(formData.get("rating") ?? "5"), 10);
  const rating = isNaN(ratingRaw) ? 5 : Math.min(5, Math.max(1, ratingRaw));

  const errors: Partial<Record<string, string>> = {};
  if (!clientName) errors.clientName = "יש למלא את שמך";
  if (!reviewText) errors.reviewText = "יש למלא את הביקורת";
  if (Object.keys(errors).length) return { errors };

  // Derive businessId from slug — never accept from client input
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!business) return { formError: "העסק לא נמצא" };

  try {
    await prisma.clientReview.create({
      data: {
        businessId: business.id,
        clientName,
        reviewText,
        rating,
        isApproved: true,
      },
    });
  } catch {
    return { formError: "אירעה שגיאה, אנא נסי שוב" };
  }

  revalidatePath(`/b/${slug}`);
  return { success: true };
}
