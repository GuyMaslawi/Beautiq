"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { updateDepositStatusAction } from "@/server/deposits/actions";
import { DEPOSITS } from "@/lib/constants/he";
import type { DepositStatus } from "@prisma/client";
import type { CSSProperties } from "react";

const BADGE_STYLES: Record<DepositStatus, CSSProperties> = {
  paid: {
    background: "rgba(61,139,110,0.10)",
    color: "#2e6b52",
    border: "1px solid rgba(61,139,110,0.22)",
  },
  pending: {
    background: "rgba(184,150,10,0.10)",
    color: "#7a6400",
    border: "1px solid rgba(184,150,10,0.22)",
  },
  not_required: {
    background: "rgba(43,37,48,0.06)",
    color: "#8a8190",
    border: "1px solid rgba(43,37,48,0.12)",
  },
  failed: {
    background: "rgba(190,74,74,0.09)",
    color: "#8b2e2e",
    border: "1px solid rgba(190,74,74,0.20)",
  },
  refunded: {
    background: "rgba(59,122,181,0.09)",
    color: "#2e5c8a",
    border: "1px solid rgba(59,122,181,0.20)",
  },
};

interface Props {
  bookingId: string;
  depositStatus: DepositStatus;
  /** Whether the booking is still active (pending/approved) */
  isActive: boolean;
}

export function DepositStatusBadge({ bookingId, depositStatus, isActive }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid() {
    startTransition(async () => {
      await updateDepositStatusAction(bookingId, "paid");
    });
  }

  // Not required — nothing to show
  if (depositStatus === "not_required") {
    return <span className="text-sm" style={{ color: "var(--muted-light)" }}>—</span>;
  }

  // Paid — success state, no further action needed
  if (depositStatus === "paid") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={BADGE_STYLES.paid}
      >
        {DEPOSITS.status.paid} ✓
      </span>
    );
  }

  // Pending + active — show clear CTA to send deposit request, plus quick mark-paid
  if (depositStatus === "pending" && isActive) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Link
          href={`/bookings/${bookingId}`}
          className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-75"
          style={{
            background: "rgba(184,150,10,0.12)",
            color: "#7a6400",
            border: "1px solid rgba(184,150,10,0.32)",
          }}
        >
          {DEPOSITS.actions.sendRequest}
        </Link>
        <button
          type="button"
          onClick={handleMarkPaid}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "rgba(61,139,110,0.08)",
            color: "#2e6b52",
            border: "1px solid rgba(61,139,110,0.20)",
          }}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span>✓ {DEPOSITS.actions.markPaidShort}</span>
          )}
        </button>
      </div>
    );
  }

  // All other states (pending+terminal, failed, refunded) — static badge
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={BADGE_STYLES[depositStatus]}
    >
      {DEPOSITS.status[depositStatus]}
    </span>
  );
}
