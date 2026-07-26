"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
import { hasOverlap } from "@/server/bookings/queries";
import { getAvailableSlots } from "@/server/availability/get-available-slots";
import { validatePublicBooking } from "@/lib/validation/public-booking";
import { parseIsraelDateTime } from "@/lib/time";
import { PUBLIC_BOOKING } from "@/lib/constants/he";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendBookingConfirmation } from "./send-confirmation";
import { notifyOwnerOfNewBooking } from "./notify-owner";

const BOOKING_RATE_WINDOW_MS = 10 * 60_000; // 10 minutes
const BOOKING_RATE_MAX = 5; // max 5 booking attempts per IP per business per 10 min
/** לא מקבלים בקשות תור רחוק מדי קדימה (מונע "תפיסת" יומן שנים מראש). */
const MAX_BOOKING_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const REVIEW_RATE_WINDOW_MS = 10 * 60_000;
const REVIEW_RATE_MAX = 5;

export interface PublicBookingFormState {
  success?: boolean;
  errors?: Partial<Record<string, string>>;
  formError?: string;
  values?: Record<string, string>;
  /**
   * Set when the chosen slot is no longer bookable (taken since it was picked,
   * or now in the past). The submit happens on the details step, which shows
   * `formError` — so these are surfaced there and the UI offers a shortcut back
   * to slot selection.
   */
  slotConflict?: boolean;
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
      formError: PUBLIC_BOOKING.errors.pastBooking,
      slotConflict: true,
      values: raw,
    };
  }

  // Don't accept bookings arbitrarily far into the future.
  if (startTime.getTime() > Date.now() + MAX_BOOKING_AHEAD_MS) {
    return {
      formError: PUBLIC_BOOKING.errors.overlap,
      slotConflict: true,
      values: raw,
    };
  }

  // Re-derive the legal slot set server-side and require exact membership.
  //
  // `date` and `requestedTime` come from client-controlled hidden inputs. They
  // were format-checked but never checked against the business's actual
  // availability: the /api/public/[slug]/slots endpoint is only what the browser
  // uses to RENDER choices. Without this, anyone could POST a time on a day the
  // business is closed, or at 3 AM, and it was created with status "approved" —
  // occupying the slot, notifying the owner, and firing an Allura-billed WhatsApp
  // confirmation. AvailabilityRule + AvailabilityException are both honored here.
  const legalSlots = await getAvailableSlots({
    businessId: tenant.businessId,
    date: value.date,
    serviceId: service.id,
  });
  if (!legalSlots.includes(value.requestedTime)) {
    return {
      formError: PUBLIC_BOOKING.errors.overlap,
      slotConflict: true,
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
      formError: PUBLIC_BOOKING.errors.overlap,
      slotConflict: true,
      values: raw,
    };
  }

  // Booking notifications are handled automatically by Allura as part of the
  // managed booking experience — no customer-facing consent checkbox. Service
  // (transactional) notifications are opted in; marketing stays off by default.
  const client = await findOrCreateClient(tenant, {
    fullName: value.clientName,
    phone: value.phone,
    whatsappOptIn: true,
    marketingOptIn: false,
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
        // A client who booked an available slot is confirmed immediately —
        // there is no manual owner approval step.
        status: "approved",
        source: "public",
        priceSnapshot: new Prisma.Decimal(service.price),
        durationMinutesSnapshot: service.durationMinutes,
        notes: value.note || null,
      },
    });
    newBookingId = booking.id;
  } catch (err) {
    // The partial unique index (businessId, startTime) on active bookings is the
    // atomic backstop for the double-booking race: if another request grabbed
    // this exact slot first, the INSERT fails with P2002. Surface it as a slot
    // conflict, not a generic error, so the customer knows to pick another time.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return {
        formError: PUBLIC_BOOKING.errors.overlap,
        slotConflict: true,
        values: raw,
      };
    }
    return { formError: PUBLIC_BOOKING.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

  // Notify the business owner automatically — primary channel is email so the
  // owner learns about the request even without opening the system. Best-effort:
  // never blocks the response and never fails booking creation. `after()` keeps
  // the runtime alive past the response on serverless so the work isn't dropped.
  after(async () => {
    try {
      await notifyOwnerOfNewBooking({
        bookingId: newBookingId,
        businessId: tenant.businessId,
      });
    } catch (err) {
      console.error("[submitPublicBookingAction] owner notification failed:", err);
    }
  });

  // Best-effort WhatsApp confirmation to the customer — never blocks the response
  after(async () => {
    try {
      await sendBookingConfirmation({
        bookingId: newBookingId,
        businessId: tenant.businessId,
        businessName: business.name,
        clientId: client.id,
        clientPhone: value.phone,
        clientName: value.clientName,
        serviceName: service.name,
        startTime,
      });
    } catch (err) {
      console.error("[submitPublicBookingAction] WA confirmation failed:", err);
    }
  });

  // The booking is confirmed immediately and the customer sees the in-form
  // confirmation. No prepayment/deposit is required in this flow.
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
  else if (clientName.length > 80) errors.clientName = "השם ארוך מדי — עד 80 תווים";
  if (!reviewText) errors.reviewText = "יש למלא את הביקורת";
  else if (reviewText.length > 1000)
    errors.reviewText = "הביקורת ארוכה מדי — עד 1000 תווים";
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
        // Reviews arrive PENDING and are published only once the owner approves
        // them on /public-page. This endpoint is unauthenticated and the reviewer
        // is not tied to a real booking, so auto-publishing handed anyone —
        // including a competitor — direct write access to a business's public
        // reputation (fake 1-star text, no approval step, deletable only after
        // the fact). Moderation is the control; the rate limit only slows it.
        isApproved: false,
      },
    });
  } catch {
    return { formError: "אירעה שגיאה, אנא נסי שוב" };
  }

  revalidatePath(`/b/${slug}`);
  return { success: true };
}
