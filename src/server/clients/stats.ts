import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

interface SyncClientStatsParams {
  businessId: string;
  clientId: string;
}

/**
 * Recompute all denormalized Client stat fields from source-of-truth Booking rows.
 * Always rewrites from scratch — never increments/decrements — so corrections and
 * status changes are handled safely without double-counting.
 *
 * Rescheduled bookings are excluded from totalBookings: a rescheduled row represents
 * a cancelled slot whose replacement is tracked as a new booking.
 */
export async function syncClientStats({
  businessId,
  clientId,
}: SyncClientStatsParams): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: { businessId, clientId },
    select: { status: true, startTime: true, priceSnapshot: true },
  });

  const completedBookings = bookings.filter((b) => b.status === "completed");

  const lastVisitAt =
    completedBookings.length > 0
      ? completedBookings.reduce((latest, b) =>
          b.startTime > latest.startTime ? b : latest,
        ).startTime
      : null;

  const totalSpent = completedBookings.reduce(
    (sum, b) => sum.add(b.priceSnapshot ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0),
  );

  await prisma.client.updateMany({
    where: { id: clientId, businessId },
    data: {
      lastVisitAt,
      totalBookings: bookings.filter((b) => b.status !== "rescheduled").length,
      noShowCount: bookings.filter((b) => b.status === "no_show").length,
      cancellationCount: bookings.filter((b) => b.status === "cancelled").length,
      totalSpent,
    },
  });
}
