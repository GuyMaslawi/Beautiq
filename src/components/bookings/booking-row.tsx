import Link from "next/link";
import { Clock, Banknote } from "lucide-react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BookingActionsMenu } from "@/components/bookings/booking-actions-menu";
import type { BookingListItem } from "@/server/bookings/queries";

const TZ = "Asia/Jerusalem";

function formatBookingDate(date: Date): { label: string; isToday: boolean } {
  const d = new Date(date);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  const bookingStr = d.toLocaleDateString("en-CA", { timeZone: TZ });

  if (bookingStr === todayStr) return { label: "היום", isToday: true };
  if (bookingStr === tomorrowStr) return { label: "מחר", isToday: false };

  return {
    label: d.toLocaleDateString("he-IL", {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }),
    isToday: false,
  };
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

export function BookingRow({ booking }: { booking: BookingListItem }) {
  const price = Number(booking.priceSnapshot);
  const duration = booking.durationMinutesSnapshot;
  const { label: dateLabel, isToday } = formatBookingDate(booking.startTime);
  const timeLabel = formatBookingTime(booking.startTime);
  const initials = getInitials(booking.client.fullName);

  const isActive =
    booking.status === "pending" || booking.status === "approved";

  const isPendingApproval = booking.status === "pending";

  return (
    <tr
      className="group border-b transition-colors hover:bg-[rgba(247,238,243,0.35)]"
      style={{
        borderColor: "var(--border)",
        ...(isPendingApproval
          ? {
              background: "rgba(172,92,127,0.07)",
              boxShadow: "inset -3px 0 0 #ac5c7f",
            }
          : {}),
      }}
    >
      {/* Client */}
      <td className="px-4 py-3">
        <Link href={`/bookings/${booking.id}`} className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              background: isActive
                ? "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)"
                : "linear-gradient(135deg, #c8b8c0 0%, #b0a0a8 100%)",
              boxShadow: isActive
                ? "0 2px 6px rgba(172,92,127,0.28)"
                : "0 1px 4px rgba(43,37,48,0.10)",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold leading-tight truncate">
              {booking.client.fullName}
            </p>
            <p className="text-xs mt-0.5" dir="ltr" style={{ color: "var(--muted)" }}>
              {booking.client.phone}
            </p>
          </div>
        </Link>
      </td>

      {/* Service */}
      <td className="px-4 py-3">
        <p className="text-foreground text-sm font-medium truncate max-w-[140px]">
          {booking.service.name}
        </p>
      </td>

      {/* Date + Time */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p
          className="text-sm font-bold"
          style={{ color: isToday ? "#ac5c7f" : "var(--foreground-soft)" }}
        >
          {dateLabel}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {timeLabel}
        </p>
      </td>

      {/* Duration */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>דק׳ {duration}</span>
        </span>
      </td>

      {/* Price */}
      <td className="px-4 py-3 whitespace-nowrap">
        {price > 0 ? (
          <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--foreground-soft)" }}>
            <Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
            ₪{price.toLocaleString("he-IL")}
          </span>
        ) : (
          <span className="text-sm" style={{ color: "var(--muted-light)" }}>—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <BookingStatusBadge status={booking.status} />
          {/* Reminder badge — only show when a reminder was actually sent */}
          {booking.reminderSentAt &&
            booking.status !== "cancelled" &&
            booking.status !== "no_show" &&
            booking.status !== "completed" && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "rgba(61,139,110,0.09)", color: "#2a6e57", border: "1px solid rgba(61,139,110,0.22)" }}
              >
                תזכורת נשלחה
              </span>
            )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <BookingActionsMenu
          bookingId={booking.id}
          status={booking.status}
          layout="row"
        />
      </td>
    </tr>
  );
}
