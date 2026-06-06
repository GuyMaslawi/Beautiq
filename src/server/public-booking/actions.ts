"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { findOrCreateClient } from "@/server/clients/find-or-create";
import { syncClientStats } from "@/server/clients/stats";
import { hasOverlap } from "@/server/bookings/queries";
import { validatePublicBooking } from "@/lib/validation/public-booking";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

export interface PublicBookingFormState {
  success?: boolean;
  errors?: Partial<Record<string, string>>;
  formError?: string;
  values?: Record<string, string>;
}

function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
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
    select: { id: true },
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

  const startTime = combineDateTime(value.date, value.requestedTime);

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

  try {
    await prisma.booking.create({
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
  } catch {
    return { formError: PUBLIC_BOOKING.errors.generic, values: raw };
  }

  await syncClientStats({ businessId: tenant.businessId, clientId: client.id });

  return { success: true };
}
