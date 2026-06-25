import { prisma } from "@/server/db/prisma";
import { parseIsraelDateTime, israeliWeekday } from "@/lib/time";

const SLOT_STEP = 30;

/**
 * Result of a day availability lookup. `open` distinguishes a day the business
 * is closed (no availability rule for that weekday) from an open day that simply
 * has no free times left — the two need different messaging in the UI.
 */
export interface DayAvailability {
  open: boolean;
  slots: string[];
}

/**
 * Return the day's availability for a given business, date, and service:
 * whether the business is open that weekday, plus the free HH:MM slot strings.
 *
 * Uses Asia/Jerusalem wall-clock time for all comparisons (weekday, day
 * boundaries, and per-slot times) so the result is correct regardless of the
 * server's own timezone. Filters out past slots and slots that overlap existing
 * pending/approved bookings.
 */
export async function getDayAvailability({
  businessId,
  date,
  serviceId,
}: {
  businessId: string;
  date: string;
  serviceId: string;
}): Promise<DayAvailability> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true },
    select: {
      durationMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
    },
  });
  // No service in this tenant → nothing to offer (and not a "closed day").
  if (!service) return { open: false, slots: [] };

  const weekday = israeliWeekday(date);

  // A date-specific exception overrides the weekly rules: `closed` shuts the day
  // entirely, `custom_hours` replaces the open window. Without this, a business
  // that marked a holiday/vacation (closed) or changed hours for one day would
  // still expose the normal weekly slots on the public booking page.
  const exception = await prisma.availabilityException.findUnique({
    where: { businessId_date: { businessId, date: new Date(date) } },
    select: { type: true, startMinutes: true, endMinutes: true },
  });

  let rules: { startMinutes: number; endMinutes: number }[];

  if (exception?.type === "closed") {
    return { open: false, slots: [] };
  } else if (exception?.type === "custom_hours") {
    // Missing custom window is treated as closed for that day (matches the
    // empty-slots engine, which skips such days).
    if (exception.startMinutes == null || exception.endMinutes == null) {
      return { open: false, slots: [] };
    }
    rules = [
      { startMinutes: exception.startMinutes, endMinutes: exception.endMinutes },
    ];
  } else {
    rules = await prisma.availabilityRule.findMany({
      where: { businessId, weekday, isActive: true },
      select: { startMinutes: true, endMinutes: true },
      orderBy: { startMinutes: "asc" },
    });
    // No rule for this weekday → the business is closed that day.
    if (rules.length === 0) return { open: false, slots: [] };
  }

  // Day boundaries in Israel wall-clock time
  const dayStart = parseIsraelDateTime(date, "00:00");
  const dayEnd = parseIsraelDateTime(date, "23:59");

  const existingBookings = await prisma.booking.findMany({
    where: {
      businessId,
      status: { in: ["pending", "approved"] },
      AND: [{ startTime: { lt: dayEnd } }, { endTime: { gt: dayStart } }],
    },
    select: { startTime: true, endTime: true },
  });

  const totalDuration =
    service.durationMinutes +
    service.bufferBeforeMinutes +
    service.bufferAfterMinutes;

  const nowMs = Date.now();
  const slots: string[] = [];

  for (const rule of rules) {
    let slotMinutes = rule.startMinutes;
    while (slotMinutes + totalDuration <= rule.endMinutes) {
      const h = Math.floor(slotMinutes / 60).toString().padStart(2, "0");
      const mn = (slotMinutes % 60).toString().padStart(2, "0");
      const slotTime = `${h}:${mn}`;

      const slotStartMs = parseIsraelDateTime(date, slotTime).getTime();
      const slotEndMs = slotStartMs + totalDuration * 60 * 1_000;

      // Skip slots more than 5 minutes in the past
      if (slotStartMs >= nowMs - 5 * 60 * 1_000) {
        const hasConflict = existingBookings.some(
          (b) =>
            b.startTime.getTime() < slotEndMs &&
            b.endTime.getTime() > slotStartMs,
        );
        if (!hasConflict) slots.push(slotTime);
      }

      slotMinutes += SLOT_STEP;
    }
  }

  return { open: true, slots };
}

/**
 * Convenience wrapper returning only the free HH:MM slot strings. Used by the
 * public booking routes that don't need the open/closed distinction.
 */
export async function getAvailableSlots(args: {
  businessId: string;
  date: string;
  serviceId: string;
}): Promise<string[]> {
  return (await getDayAvailability(args)).slots;
}
