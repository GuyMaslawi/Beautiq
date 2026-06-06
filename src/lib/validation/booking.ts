import { isValidIsraeliPhone } from "@/lib/phone";
import { BOOKINGS } from "@/lib/constants/he";

export interface BookingInput {
  clientName: string;
  phone: string;
  serviceId: string;
  date: string;
  startTime: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof BookingInput, string>>;

export type BookingValidationResult =
  | { ok: true; value: BookingInput }
  | { ok: false; errors: FieldErrors };

export function validateBooking(
  raw: Record<string, string>,
): BookingValidationResult {
  const errors: FieldErrors = {};

  const clientName = (raw.clientName ?? "").trim();
  if (!clientName) errors.clientName = BOOKINGS.errors.clientNameRequired;

  const phone = (raw.phone ?? "").trim();
  if (!phone) {
    errors.phone = BOOKINGS.errors.phoneRequired;
  } else if (!isValidIsraeliPhone(phone)) {
    errors.phone = BOOKINGS.errors.phoneInvalid;
  }

  const serviceId = (raw.serviceId ?? "").trim();
  if (!serviceId) errors.serviceId = BOOKINGS.errors.serviceRequired;

  const date = (raw.date ?? "").trim();
  if (!date) errors.date = BOOKINGS.errors.dateRequired;

  const startTime = (raw.startTime ?? "").trim();
  if (!startTime) errors.startTime = BOOKINGS.errors.startTimeRequired;

  const notes = (raw.notes ?? "").trim();

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { clientName, phone, serviceId, date, startTime, notes },
  };
}
