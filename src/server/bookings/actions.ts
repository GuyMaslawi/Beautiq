"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import { getBooking, hasOverlap } from "@/server/bookings/queries";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
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

  try {
    await prisma.booking.create({
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
  } catch {
    return { formError: BOOKINGS.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

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

export async function approveBookingAction(bookingId: string): Promise<void> {
  const tenant = await requireTenant();
  await prisma.booking.updateMany({
    where: { id: bookingId, businessId: tenant.businessId, status: "pending" },
    data: { status: "approved" },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}

export async function completeBookingAction(bookingId: string): Promise<void> {
  const tenant = await requireTenant();
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId: tenant.businessId },
    select: { clientId: true },
  });
  await prisma.booking.updateMany({
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
  await prisma.booking.updateMany({
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
  await prisma.booking.updateMany({
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
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Late cancellation fee tracking
// ---------------------------------------------------------------------------

export async function markLateCancellationFeePendingAction(
  bookingId: string,
): Promise<void> {
  const tenant = await requireTenant();
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      businessId: tenant.businessId,
      status: { in: ["cancelled", "no_show"] },
    },
    data: { lateCancellationFeeStatus: "pending" },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}

export async function markLateCancellationFeePaidAction(
  bookingId: string,
): Promise<void> {
  const tenant = await requireTenant();
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      businessId: tenant.businessId,
      status: { in: ["cancelled", "no_show"] },
    },
    data: { lateCancellationFeeStatus: "paid" },
  });
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}
