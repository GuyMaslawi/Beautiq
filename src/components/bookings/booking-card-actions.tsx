"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  approveBookingAction,
  completeBookingAction,
  cancelBookingAction,
  noShowBookingAction,
} from "@/server/bookings/actions";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

export function BookingCardActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<void>) => {
    startTransition(() => action());
  };

  const isTerminal =
    status === "completed" ||
    status === "cancelled" ||
    status === "no_show" ||
    status === "rescheduled";

  return (
    <div
      className="flex flex-wrap gap-2 px-4 py-3"
      style={{ borderTop: "1px solid var(--border)", background: "rgba(43,37,48,0.02)" }}
    >
      <Link href={`/bookings/${bookingId}`}>
        <Button size="sm" variant="secondary" className="h-8 px-3 text-xs">
          {BOOKINGS.card.viewDetails}
        </Button>
      </Link>

      {!isTerminal && (
        <>
          {status === "pending" && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={isPending}
              onClick={() => run(() => approveBookingAction(bookingId))}
            >
              {BOOKINGS.card.quickApprove}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
            disabled={isPending}
            onClick={() => run(() => completeBookingAction(bookingId))}
          >
            {BOOKINGS.card.quickComplete}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            disabled={isPending}
            onClick={() => run(() => noShowBookingAction(bookingId))}
          >
            {BOOKINGS.card.quickNoShow}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isPending}
            onClick={() => run(() => cancelBookingAction(bookingId))}
          >
            {BOOKINGS.card.quickCancel}
          </Button>
        </>
      )}
    </div>
  );
}
