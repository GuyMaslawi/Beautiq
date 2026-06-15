// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { PAYMENTS } from "@/lib/constants/he";
import type { BookingPaymentStatus } from "@prisma/client";

describe("PaymentStatusBadge (owner UI)", () => {
  const cases: BookingPaymentStatus[] = [
    "pending",
    "payment_link_created",
    "paid",
    "failed",
    "cancelled",
    "expired",
    "refunded",
  ];

  it.each(cases)("renders the Hebrew label for %s", (status) => {
    render(<PaymentStatusBadge status={status} />);
    expect(screen.getByText(PAYMENTS.ownerStatus[status])).toBeInTheDocument();
  });
});
