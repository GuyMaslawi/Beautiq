"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
import { hasOverlap } from "@/server/bookings/queries";
import { validatePublicBooking } from "@/lib/validation/public-booking";
import { parseIsraelDateTime } from "@/lib/time";
import { PUBLIC_BOOKING } from "@/lib/constants/he";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
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
        depositStatus: service.requiresDeposit ? "pending" : "not_required",
        priceSnapshot: new Prisma.Decimal(service.price),
        depositAmountSnapshot: service.depositAmount
          ? new Prisma.Decimal(service.depositAmount)
          : null,
        durationMinutesSnapshot: service.durationMinutes,
        notes: value.note || null,
      },
    });
    newBookingId = booking.id;
  } catch {
    return { formError: PUBLIC_BOOKING.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

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

  return { success: true };
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
