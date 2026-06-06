import { Phone, Clock, Banknote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingCardActions } from "@/components/bookings/booking-card-actions";
import { DepositStatusBadge } from "@/components/deposits/deposit-status-badge";
import type { BookingListItem } from "@/server/bookings/queries";

function formatBookingDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterStart = new Date(tomorrowStart);
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);

  const bookingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (bookingDay.getTime() === todayStart.getTime()) return "היום";
  if (bookingDay.getTime() === tomorrowStart.getTime()) return "מחר";

  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatBookingTime(date: Date): string {
  return new Date(date).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function BookingCard({ booking }: { booking: BookingListItem }) {
  const price = Number(booking.priceSnapshot);
  const duration = booking.durationMinutesSnapshot;
  const dateLabel = formatBookingDate(booking.startTime);
  const timeLabel = formatBookingTime(booking.startTime);

  const isImportant =
    booking.status === "pending" || booking.status === "approved";

  return (
    <Card
      className="p-4 transition-shadow hover:shadow-md"
      style={
        isImportant
          ? {
              borderColor: "rgba(184,107,140,0.18)",
              background:
                "linear-gradient(160deg, rgba(247,238,243,0.55) 0%, rgba(255,255,255,1) 55%)",
            }
          : undefined
      }
    >
      {/* Top row: date + time / status badge */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-muted text-sm font-medium">
          {dateLabel} · {timeLabel}
        </span>
        <BookingStatusBadge status={booking.status} />
      </div>

      {/* Client name */}
      <p className="text-foreground mb-0.5 text-base font-semibold">
        {booking.client.fullName}
      </p>

      {/* Service name */}
      <p className="text-muted mb-3 text-sm">{booking.service.name}</p>

      {/* Secondary row: phone · duration · price */}
      <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3 shrink-0" />
          <span dir="ltr">{booking.client.phone}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{duration} דק׳</span>
        </span>
        {price > 0 && (
          <span className="flex items-center gap-1">
            <Banknote className="h-3 w-3 shrink-0" />
            <span>₪{price.toLocaleString("he-IL")}</span>
          </span>
        )}
      </div>

      {/* Deposit badge / source badge row */}
      {(booking.depositStatus !== "not_required" || booking.source === "public") && (
        <div className="mt-2 flex flex-wrap gap-2">
          {booking.depositStatus !== "not_required" && (
            <DepositStatusBadge status={booking.depositStatus} />
          )}
          {booking.source === "public" && (
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: "rgba(184,107,140,0.08)", color: "#b86b8c" }}
            >
              קישור הזמנה
            </span>
          )}
        </div>
      )}

      {/* Quick actions */}
      <BookingCardActions bookingId={booking.id} status={booking.status} />
    </Card>
  );
}
