import { isValidIsraeliPhone } from "@/lib/phone";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

export interface PublicBookingInput {
  serviceId: string;
  clientName: string;
  phone: string;
  date: string;
  requestedTime: string;
  note: string;
}

type FieldErrors = Partial<Record<keyof PublicBookingInput, string>>;

export type PublicBookingValidationResult =
  | { ok: true; value: PublicBookingInput }
  | { ok: false; errors: FieldErrors };

export function validatePublicBooking(
  raw: Record<string, string>,
): PublicBookingValidationResult {
  const errors: FieldErrors = {};

  const serviceId = (raw.serviceId ?? "").trim();
  if (!serviceId) errors.serviceId = PUBLIC_BOOKING.errors.serviceRequired;

  const clientName = (raw.clientName ?? "").trim();
  if (!clientName) errors.clientName = PUBLIC_BOOKING.errors.clientNameRequired;

  const phone = (raw.phone ?? "").trim();
  if (!phone) {
    errors.phone = PUBLIC_BOOKING.errors.phoneRequired;
  } else if (!isValidIsraeliPhone(phone)) {
    errors.phone = PUBLIC_BOOKING.errors.phoneInvalid;
  }

  const date = (raw.date ?? "").trim();
  if (!date) errors.date = PUBLIC_BOOKING.errors.dateRequired;

  const requestedTime = (raw.requestedTime ?? "").trim();
  if (!requestedTime) errors.requestedTime = PUBLIC_BOOKING.errors.timeRequired;

  const note = (raw.note ?? "").trim();

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { serviceId, clientName, phone, date, requestedTime, note },
  };
}
