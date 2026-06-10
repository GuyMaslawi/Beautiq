"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Eye, CheckCircle2, CheckCheck, XCircle, UserX, MessageCircle } from "lucide-react";
import {
  approveBookingAction,
  completeBookingAction,
  cancelBookingAction,
  noShowBookingAction,
} from "@/server/bookings/actions";
import type { BookingStatus } from "@prisma/client";

interface IconBtnProps {
  label: string;
  color: string;
  hoverClass: string;
  ringColor: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}

function IconBtn({ label, color, hoverClass, ringColor, onClick, disabled, children }: IconBtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40`}
      style={{ color, ["--tw-ring-color" as string]: ringColor }}
    >
      {children}
    </button>
  );
}

export function BookingRowActions({
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
    <div className="flex items-center gap-0.5">
      {/* צפייה בפרטים */}
      <Link
        href={`/bookings/${bookingId}`}
        aria-label="צפייה בפרטים"
        title="צפייה בפרטים"
        className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ color: "var(--muted)" }}
      >
        <Eye className="h-4 w-4" />
      </Link>

      {!isTerminal && (
        <>
          {/* אישור תור — only for pending */}
          {status === "pending" && (
            <IconBtn
              label="אישור תור"
              color="#16a34a"
              hoverClass="hover:bg-green-50"
              ringColor="#16a34a"
              onClick={() => run(() => approveBookingAction(bookingId))}
              disabled={isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
            </IconBtn>
          )}

          {/* סיום טיפול */}
          <IconBtn
            label="סיום טיפול"
            color="#059669"
            hoverClass="hover:bg-emerald-50"
            ringColor="#059669"
            onClick={() => run(() => completeBookingAction(bookingId))}
            disabled={isPending}
          >
            <CheckCheck className="h-4 w-4" />
          </IconBtn>

          {/* סימון כלקוחה שלא הגיעה */}
          <IconBtn
            label="סימון כלקוחה שלא הגיעה"
            color="#ea580c"
            hoverClass="hover:bg-orange-50"
            ringColor="#ea580c"
            onClick={() => run(() => noShowBookingAction(bookingId))}
            disabled={isPending}
          >
            <UserX className="h-4 w-4" />
          </IconBtn>

          {/* ביטול תור */}
          <IconBtn
            label="ביטול תור"
            color="#dc2626"
            hoverClass="hover:bg-red-50"
            ringColor="#dc2626"
            onClick={() => run(() => cancelBookingAction(bookingId))}
            disabled={isPending}
          >
            <XCircle className="h-4 w-4" />
          </IconBtn>
        </>
      )}

      {/* שליחת הודעה */}
      <Link
        href="/messages"
        aria-label="שליחת הודעה"
        title="שליחת הודעה"
        className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ color: "#e11d6a" }}
      >
        <MessageCircle className="h-4 w-4" />
      </Link>

    </div>
  );
}
