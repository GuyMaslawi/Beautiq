import type { CSSProperties } from "react";
import type { BookingPaymentStatus } from "@prisma/client";
import { PAYMENTS } from "@/lib/constants/he";

const BADGE_STYLES: Record<BookingPaymentStatus, CSSProperties> = {
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
  payment_link_created: {
    background: "rgba(184,150,10,0.10)",
    color: "#7a6400",
    border: "1px solid rgba(184,150,10,0.22)",
  },
  failed: {
    background: "rgba(190,74,74,0.09)",
    color: "#8b2e2e",
    border: "1px solid rgba(190,74,74,0.20)",
  },
  cancelled: {
    background: "rgba(43,37,48,0.06)",
    color: "#8a8190",
    border: "1px solid rgba(43,37,48,0.12)",
  },
  expired: {
    background: "rgba(43,37,48,0.06)",
    color: "#8a8190",
    border: "1px solid rgba(43,37,48,0.12)",
  },
  refunded: {
    background: "rgba(59,122,181,0.09)",
    color: "#2e5c8a",
    border: "1px solid rgba(59,122,181,0.20)",
  },
};

/**
 * Read-only online-payment status badge for owner booking views. Reflects the
 * hosted payment-link state for a full online payment.
 */
export function PaymentStatusBadge({ status }: { status: BookingPaymentStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={BADGE_STYLES[status]}
    >
      {PAYMENTS.ownerStatus[status]}
    </span>
  );
}
