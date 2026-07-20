"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

interface BookingActionsProps {
  status: BookingStatus;
  completeAction: () => Promise<void>;
  cancelAction: () => Promise<void>;
  noShowAction: () => Promise<void>;
}

export function BookingActions({
  status,
  completeAction,
  cancelAction,
  noShowAction,
}: BookingActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const run = (action: () => Promise<void>, msg: string) => {
    setSuccessMsg(null);
    startTransition(async () => {
      await action();
      setSuccessMsg(msg);
    });
  };

  if (
    status === "completed" ||
    status === "cancelled" ||
    status === "no_show" ||
    status === "rescheduled"
  ) {
    return null;
  }

  return (
    <Card className="space-y-3 p-5">
      <p className="text-muted text-xs font-semibold uppercase tracking-wider">
        {BOOKINGS.actions.sectionTitle}
      </p>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-medium">
          {successMsg}
        </div>
      )}

      {(status === "pending" || status === "approved") && (
        <>
          <Button
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={() => run(completeAction, BOOKINGS.actions.successComplete)}
          >
            {isPending
              ? BOOKINGS.actions.completing
              : BOOKINGS.actions.complete}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={() => run(noShowAction, BOOKINGS.actions.successNoShow)}
          >
            {isPending
              ? BOOKINGS.actions.markingNoShow
              : BOOKINGS.actions.noShow}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50"
            disabled={isPending}
            onClick={() => run(cancelAction, BOOKINGS.actions.successCancel)}
          >
            {isPending
              ? BOOKINGS.actions.cancelling
              : BOOKINGS.actions.cancel}
          </Button>
        </>
      )}
    </Card>
  );
}
