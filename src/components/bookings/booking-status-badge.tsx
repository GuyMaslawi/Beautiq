import type { CSSProperties } from "react";
import { BOOKING_STATUS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

const statusStyles: Record<BookingStatus, CSSProperties> = {
  // Active bookings (pending/approved) are shown without a badge — a client who
  // grabbed an available slot is simply booked; there is nothing to approve.
  pending: {},
  approved: {},
  completed: {
    background: "rgba(61,139,110,0.10)",
    color: "#2e6b52",
    border: "1px solid rgba(61,139,110,0.22)",
  },
  cancelled: {
    background: "rgba(43,37,48,0.06)",
    color: "#8a8190",
    border: "1px solid rgba(43,37,48,0.12)",
  },
  no_show: {
    background: "rgba(190,74,74,0.09)",
    color: "#8b2e2e",
    border: "1px solid rgba(190,74,74,0.20)",
  },
  rescheduled: {
    background: "rgba(59,122,181,0.09)",
    color: "#2e5c8a",
    border: "1px solid rgba(59,122,181,0.20)",
  },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  // Active bookings carry no meaningful status to display — skip the badge.
  if (status === "pending" || status === "approved") return null;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={statusStyles[status]}
    >
      {BOOKING_STATUS[status]}
    </span>
  );
}
