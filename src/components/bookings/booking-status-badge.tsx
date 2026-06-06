import { BOOKING_STATUS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

const statusStyles: Record<BookingStatus, string> = {
  pending:
    "bg-yellow-50 text-yellow-700 border border-yellow-200",
  approved:
    "bg-blue-50 text-blue-700 border border-blue-200",
  completed:
    "bg-green-50 text-green-700 border border-green-200",
  cancelled:
    "bg-gray-100 text-gray-500 border border-gray-200",
  no_show:
    "bg-red-50 text-red-600 border border-red-200",
  rescheduled:
    "bg-purple-50 text-purple-700 border border-purple-200",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {BOOKING_STATUS[status]}
    </span>
  );
}
