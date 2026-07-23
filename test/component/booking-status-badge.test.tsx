// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BOOKING_STATUS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

// Active bookings (pending/approved) render no badge — a client who grabbed an
// available slot is simply booked; there is nothing to approve.
const ACTIVE_STATUSES: BookingStatus[] = ["pending", "approved"];
const LABELLED_STATUSES: BookingStatus[] = [
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

describe("BookingStatusBadge", () => {
  it.each(ACTIVE_STATUSES)("renders nothing for active status %s", (status) => {
    const { container } = render(<BookingStatusBadge status={status} />);
    expect(container.firstChild).toBeNull();
  });

  it.each(LABELLED_STATUSES)("renders the Hebrew label for %s", (status) => {
    render(<BookingStatusBadge status={status} />);
    expect(screen.getByText(BOOKING_STATUS[status])).toBeInTheDocument();
  });

  it("applies a distinct background color per labelled status", () => {
    const { container: c1 } = render(<BookingStatusBadge status="completed" />);
    const { container: c2 } = render(<BookingStatusBadge status="cancelled" />);
    const bg1 = (c1.firstChild as HTMLElement).style.background;
    const bg2 = (c2.firstChild as HTMLElement).style.background;
    expect(bg1).not.toBe("");
    expect(bg1).not.toBe(bg2);
  });

  it("renders as an inline rounded-full pill span for labelled statuses", () => {
    const { container } = render(<BookingStatusBadge status="completed" />);
    const span = container.firstChild as HTMLElement;
    expect(span.tagName).toBe("SPAN");
    expect(span).toHaveClass("rounded-full");
  });
});
