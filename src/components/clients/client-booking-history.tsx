import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { DepositStatusBadge } from "@/components/deposits/deposit-status-badge";
import { CLIENTS, BOOKINGS } from "@/lib/constants/he";
import type { ClientBookingHistoryItem } from "@/server/clients/queries";

function formatHistoryDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const bookingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (bookingDay.getTime() === todayStart.getTime()) return `היום · ${time}`;
  if (bookingDay.getTime() === tomorrowStart.getTime()) return `מחר · ${time}`;

  const dateStr = d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${dateStr} · ${time}`;
}

export function ClientBookingHistory({
  clientId,
  bookings,
}: {
  clientId: string;
  bookings: ClientBookingHistoryItem[];
}) {
  if (bookings.length === 0) {
    return (
      <div className="py-8 text-center">
        <h3 className="text-foreground text-base font-semibold">
          {CLIENTS.detail.noBookingsTitle}
        </h3>
        <p className="text-muted mx-auto mt-2 max-w-xs text-sm leading-6">
          {CLIENTS.detail.noBookingsBody}
        </p>
        <div className="mt-4">
          <Link href={`/bookings/new?clientId=${clientId}`}>
            <Button variant="secondary" size="sm">
              {CLIENTS.detail.noBookingsCta}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-border divide-y">
      {bookings.map((booking) => {
        const price = Number(booking.priceSnapshot);
        return (
          <div key={booking.id} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              {/* Date */}
              <p className="text-muted text-xs">
                {formatHistoryDate(booking.startTime)}
              </p>
              {/* Service name */}
              <p className="text-foreground mt-0.5 text-sm font-medium">
                {booking.service.name}
              </p>
              {/* Duration + price */}
              <div className="text-muted mt-0.5 flex items-center gap-2 text-xs">
                <span>
                  {booking.durationMinutesSnapshot} {BOOKINGS.card.minutesShort}
                </span>
                {price > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>
                      {BOOKINGS.card.price}
                      {price.toLocaleString("he-IL")}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Status badge + deposit + link */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <BookingStatusBadge status={booking.status} />
                <Link
                  href={`/bookings/${booking.id}`}
                  className="text-primary text-xs hover:underline"
                >
                  {CLIENTS.detail.viewBooking}
                </Link>
              </div>
              {booking.depositStatus !== "not_required" && (
                <DepositStatusBadge status={booking.depositStatus} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
