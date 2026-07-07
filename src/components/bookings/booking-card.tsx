import { Phone, Clock, Banknote, CalendarDays } from "lucide-react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingActionsMenu } from "@/components/bookings/booking-actions-menu";
import type { BookingListItem } from "@/server/bookings/queries";

const TZ = "Asia/Jerusalem";

function formatBookingDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  const bookingStr = d.toLocaleDateString("en-CA", { timeZone: TZ });

  if (bookingStr === todayStr) return "היום";
  if (bookingStr === tomorrowStr) return "מחר";

  return d.toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatBookingTime(date: Date): string {
  return new Date(date).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

export function BookingCard({ booking }: { booking: BookingListItem }) {
  const price = Number(booking.priceSnapshot);
  const duration = booking.durationMinutesSnapshot;
  const dateLabel = formatBookingDate(booking.startTime);
  const timeLabel = formatBookingTime(booking.startTime);
  const isToday = dateLabel === "היום";

  const isActive =
    booking.status === "pending" || booking.status === "approved";

  return (
    <div
      className="lift group overflow-hidden rounded-[1.35rem]"
      style={
        isActive
          ? {
              background: "linear-gradient(165deg, rgba(243,238,246,0.7) 0%, rgba(255,255,255,0.92) 55%)",
              border: "1px solid rgba(146,96,159,0.22)",
              boxShadow: "0 8px 24px -12px rgba(124,58,97,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
            }
          : {
              background: "linear-gradient(170deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.84) 100%)",
              border: "1px solid rgba(172,92,127,0.12)",
              boxShadow: "0 6px 20px -12px rgba(124,58,97,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
            }
      }
    >
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">

        {/* Avatar */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: isActive
              ? "linear-gradient(135deg, #c76f93 0%, #92609f 100%)"
              : "linear-gradient(135deg, #c8b8c0 0%, #b0a0a8 100%)",
            boxShadow: isActive
              ? "0 6px 16px -6px rgba(146,96,159,0.5)"
              : "0 1px 4px rgba(43,37,48,0.10)",
          }}
        >
          {getInitials(booking.client.fullName)}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">

          {/* Top row: name + status */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-base font-bold leading-tight">
                {booking.client.fullName}
              </p>
              <p className="text-muted mt-0.5 text-sm">{booking.service.name}</p>
            </div>
            <BookingStatusBadge status={booking.status} />
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">

            {/* Date + time */}
            <span className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: isToday ? "#ac5c7f" : "var(--foreground-soft)" }}>
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{dateLabel}</span>
              <span className="font-normal" style={{ color: "var(--muted)" }}>
                · {timeLabel}
              </span>
            </span>

            {/* Phone */}
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span dir="ltr">{booking.client.phone}</span>
            </span>

            {/* Duration */}
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{duration} דק׳</span>
            </span>

            {/* Price */}
            {price > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
                <Banknote className="h-3.5 w-3.5 shrink-0" />
                <span>₪{price.toLocaleString("he-IL")}</span>
              </span>
            )}
          </div>

          {/* Badges row */}
          {booking.source === "public" && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: "rgba(59,122,181,0.09)", color: "#2e5c8a", border: "1px solid rgba(59,122,181,0.18)" }}
              >
                קישור הזמנה
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <BookingActionsMenu bookingId={booking.id} status={booking.status} layout="card" />
    </div>
  );
}
