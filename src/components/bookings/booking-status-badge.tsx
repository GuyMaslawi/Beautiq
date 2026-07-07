import type { CSSProperties } from "react";
import { BOOKING_STATUS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

const statusStyles: Record<BookingStatus, CSSProperties> = {
  pending: {
    background: "rgba(184,150,10,0.10)",
    color: "#7a6400",
    border: "1px solid rgba(184,150,10,0.22)",
  },
  approved: {
    background: "rgba(172,92,127,0.10)",
    color: "#8a3d60",
    border: "1px solid rgba(172,92,127,0.22)",
  },
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
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={statusStyles[status]}
    >
      {BOOKING_STATUS[status]}
    </span>
  );
}
