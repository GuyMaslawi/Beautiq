import { prisma } from "@/server/db/prisma";
import { parseIsraelDateTime } from "@/lib/time";

const SLOT_STEP = 30;

/**
 * Return available HH:MM slot strings for a given business, date, and service.
 * Uses Asia/Jerusalem wall-clock time for all comparisons.
 * Filters out past slots and slots that overlap existing pending/approved bookings.
 */
export async function getAvailableSlots({
  businessId,
  date,
  serviceId,
}: {
  businessId: string;
  date: string;
  serviceId: string;
}): Promise<string[]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true },
    select: {
      durationMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
    },
  });
  if (!service) return [];

  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  const rules = await prisma.availabilityRule.findMany({
    where: { businessId, weekday, isActive: true },
    select: { startMinutes: true, endMinutes: true },
    orderBy: { startMinutes: "asc" },
  });
  if (rules.length === 0) return [];

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

  return slots;
}
