// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { BOOKING_STATUS } from "@/lib/constants/he";
import type { BookingStatus } from "@prisma/client";

const ALL_STATUSES: BookingStatus[] = [
  "pending",
  "approved",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

describe("BookingStatusBadge", () => {
  it.each(ALL_STATUSES)("renders the Hebrew label for %s", (status) => {
    render(<BookingStatusBadge status={status} />);
    expect(screen.getByText(BOOKING_STATUS[status])).toBeInTheDocument();
  });

  it("applies a distinct background color per status", () => {
    const { container: c1 } = render(<BookingStatusBadge status="pending" />);
    const { container: c2 } = render(<BookingStatusBadge status="completed" />);
    const bg1 = (c1.firstChild as HTMLElement).style.background;
    const bg2 = (c2.firstChild as HTMLElement).style.background;
    expect(bg1).not.toBe("");
    expect(bg1).not.toBe(bg2);
  });

  it("renders as an inline rounded-full pill span", () => {
    const { container } = render(<BookingStatusBadge status="approved" />);
    const span = container.firstChild as HTMLElement;
    expect(span.tagName).toBe("SPAN");
    expect(span).toHaveClass("rounded-full");
  });
});
