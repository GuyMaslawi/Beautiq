"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getBooking, hasOverlap } from "@/server/bookings/queries";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
import { sendBookingConfirmationById } from "@/server/public-booking/send-confirmation";
import { sendThankYouForCompletedBooking } from "@/server/review-request/on-complete";
import { notifyOwnerOfClientEvent } from "@/server/notifications/owner-email";
import { logActivity } from "@/server/activity/log";
import { validateBooking } from "@/lib/validation/booking";
import { parseIsraelDateTime } from "@/lib/time";
import { BOOKINGS } from "@/lib/constants/he";

export interface BookingFormState {
  success?: boolean;
  errors?: Partial<Record<string, string>>;
  formError?: string;
  values?: Record<string, string>;
}

function extractRaw(formData: FormData): Record<string, string> {
  return {
    clientName: String(formData.get("clientName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    serviceId: String(formData.get("serviceId") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}


export async function createBookingAction(
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const tenant = await requireTenant();
  const raw = extractRaw(formData);
  const result = validateBooking(raw);

  if (!result.ok) return { errors: result.errors, values: raw };

  const { value } = result;

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
      errors: { serviceId: BOOKINGS.errors.serviceUnavailable },
      values: raw,
    };
  }

  const startTime = parseIsraelDateTime(value.date, value.startTime);

  // Validate not in the past (allow up to 5 min tolerance)
  if (startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    return {
      errors: { startTime: BOOKINGS.errors.pastBooking },
      values: raw,
    };
  }

  // Calculate endTime using service duration + buffers
  const totalMinutes =
    service.durationMinutes +
    service.bufferBeforeMinutes +
    service.bufferAfterMinutes;
  const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);

  // Overlap check
  const overlaps = await hasOverlap(tenant, startTime, endTime);
  if (overlaps) {
    return {
      errors: { startTime: BOOKINGS.errors.overlap },
      values: raw,
    };
  }

  // Find or create the client
  const client = await findOrCreateClient(tenant, {
    fullName: value.clientName,
    phone: value.phone,
  });

  let created: { id: string };
  try {
    created = await prisma.booking.create({
      data: {
        businessId: tenant.businessId,
        clientId: client.id,
        serviceId: service.id,
        startTime,
        endTime,
        status: "approved",
        source: "manual",
        priceSnapshot: new Prisma.Decimal(service.price),
        durationMinutesSnapshot: service.durationMinutes,
        notes: value.notes || null,
      },
    });
  } catch (err) {
    // Atomic double-booking guard (partial unique index on active bookings):
    // if the slot was taken between the overlap check and this INSERT, P2002 is
    // raised — report it on the startTime field rather than as a generic error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { errors: { startTime: BOOKINGS.errors.overlap }, values: raw };
    }
    return { formError: BOOKINGS.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

  await logActivity({
    businessId: tenant.businessId,
    category: "booking",
    action: "booking.create",
    summary: `נקבע תור חדש ל${value.clientName} — ${service.name}`,
    metadata: {
      bookingId: created.id,
      clientName: value.clientName,
      serviceName: service.name,
    },
  });

  // An owner-created booking is approved immediately — send the WhatsApp
  // confirmation (subject to all existing safety guards). Awaited so it runs
  // before the redirect below terminates this request; it never throws.
  await sendBookingConfirmationById({
    bookingId: created.id,
    businessId: tenant.businessId,
    source: "manual_owner",
  });

  // התראת אימייל לבעלת העסק (רק אם הפעילה בהגדרות) — best-effort.
  await notifyOwnerOfClientEvent({
    businessId: tenant.businessId,
    bookingId: created.id,
    event: "booking_created",
  });

  revalidatePath("/bookings");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect("/bookings?created=true");
}

export async function updateBookingNotesAction(
  bookingId: string,
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const tenant = await requireTenant();
  const booking = await getBooking(tenant, bookingId);
  if (!booking) return { formError: BOOKINGS.errors.notFound };

  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await prisma.booking.updateMany({
      where: { id: bookingId, businessId: tenant.businessId },
      data: { notes: notes || null },
    });
  } catch {
    return { formError: BOOKINGS.errors.generic };
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Status transition actions (inline status changes, no form needed)
// ---------------------------------------------------------------------------

export async function completeBookingAction(bookingId: string): Promise<void> {
  const tenant = await requireTenant();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: { clientId: true },
  });
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      businessId: tenant.businessId,
      status: { in: ["pending", "approved"] },
    },
    data: { status: "completed", completedAt: new Date() },
  });
  if (booking) {
    await syncClientStats({ businessId: tenant.businessId, clientId: booking.clientId });
  }
  if (updated.count > 0) {
    // Send the thank-you / review WhatsApp to the client immediately (respects the
    // review_request toggle; dedupes with the cron via reviewRequestSentAt).
    await sendThankYouForCompletedBooking({
      businessId: tenant.businessId,
      bookingId,
    });
    await notifyOwnerOfClientEvent({
      businessId: tenant.businessId,
      bookingId,
      event: "booking_completed",
    });
    await logActivity({
      businessId: tenant.businessId,
      category: "booking",
      action: "booking.complete",
      summary: "תור סומן כהושלם",
      metadata: { bookingId },
    });
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}

export async function cancelBookingAction(bookingId: string): Promise<void> {
  const tenant = await requireTenant();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: { clientId: true },
  });
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      businessId: tenant.businessId,
      status: { in: ["pending", "approved"] },
    },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
  if (booking) {
    await syncClientStats({ businessId: tenant.businessId, clientId: booking.clientId });
  }
  if (updated.count > 0) {
    await notifyOwnerOfClientEvent({
      businessId: tenant.businessId,
      bookingId,
      event: "booking_cancelled",
    });
    await logActivity({
      businessId: tenant.businessId,
      category: "booking",
      action: "booking.cancel",
      summary: "תור בוטל",
      metadata: { bookingId },
    });
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}

export async function noShowBookingAction(bookingId: string): Promise<void> {
  const tenant = await requireTenant();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: { clientId: true },
  });
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      businessId: tenant.businessId,
      status: { in: ["pending", "approved"] },
    },
    data: { status: "no_show", noShowAt: new Date() },
  });
  if (booking) {
    await syncClientStats({ businessId: tenant.businessId, clientId: booking.clientId });
  }
  if (updated.count > 0) {
    await notifyOwnerOfClientEvent({
      businessId: tenant.businessId,
      bookingId,
      event: "booking_no_show",
    });
    await logActivity({
      businessId: tenant.businessId,
      category: "booking",
      action: "booking.no_show",
      summary: "לקוחה סומנה כלא הגיעה",
      metadata: { bookingId },
    });
  }
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}
