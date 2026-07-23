// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingCard } from "@/components/bookings/booking-card";
import type { BookingListItem } from "@/server/bookings/queries";

// BookingActionsMenu (rendered inside) uses the router + server actions.
const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/server/bookings/actions", () => ({
  approveBookingAction: vi.fn(async () => {}),
  completeBookingAction: vi.fn(async () => {}),
  cancelBookingAction: vi.fn(async () => {}),
  noShowBookingAction: vi.fn(async () => {}),
}));
vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => "div" }),
  };
});

function makeBooking(overrides: Partial<BookingListItem> = {}): BookingListItem {
  const base = {
    id: "bk1",
    status: "approved",
    source: "manual",
    startTime: new Date("2099-12-25T10:30:00Z"),
    priceSnapshot: 180,
    durationMinutesSnapshot: 60,
    reminderSentAt: null,
    cancelledAt: null,
    noShowAt: null,
    lateCancellationFeeStatus: null,
    client: { id: "c1", fullName: "נועה כהן", phone: "0501234567" },
    service: { id: "s1", name: "מניקור ג'ל", durationMinutes: 60 },
  };
  return { ...base, ...overrides } as unknown as BookingListItem;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingCard", () => {
  it("renders client name, service, phone and duration without a status badge for an active booking", () => {
    render(<BookingCard booking={makeBooking()} />);
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("0501234567")).toBeInTheDocument();
    expect(screen.getByText("60 דק׳")).toBeInTheDocument();
    // Active bookings carry no status badge — nothing to approve.
    expect(screen.queryByText("מאושר")).not.toBeInTheDocument();
  });

  it("shows the formatted price when the price is positive", () => {
    render(<BookingCard booking={makeBooking({ priceSnapshot: 180 } as never)} />);
    expect(screen.getByText("₪180")).toBeInTheDocument();
  });

  it("hides the price when it is zero", () => {
    render(<BookingCard booking={makeBooking({ priceSnapshot: 0 } as never)} />);
    expect(screen.queryByText(/₪/)).not.toBeInTheDocument();
  });

  it("shows the 'קישור הזמנה' badge for public-source bookings", () => {
    render(<BookingCard booking={makeBooking({ source: "public" } as never)} />);
    expect(screen.getByText("קישור הזמנה")).toBeInTheDocument();
  });

  it("does not show the public-source badge for manual bookings", () => {
    render(<BookingCard booking={makeBooking({ source: "manual" } as never)} />);
    expect(screen.queryByText("קישור הזמנה")).not.toBeInTheDocument();
  });

  it("renders the initials avatar from the client's name", () => {
    render(<BookingCard booking={makeBooking()} />);
    // "נועה כהן" → first letters of first two words
    expect(screen.getByText("נכ")).toBeInTheDocument();
  });

  it("shows 'היום' label for a booking that starts today", () => {
    const today = new Date();
    today.setHours(11, 0, 0, 0);
    render(<BookingCard booking={makeBooking({ startTime: today } as never)} />);
    expect(screen.getByText("היום")).toBeInTheDocument();
  });

  it("shows 'מחר' label for a booking that starts tomorrow", () => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(11, 0, 0, 0);
    render(<BookingCard booking={makeBooking({ startTime: tomorrow } as never)} />);
    expect(screen.getByText("מחר")).toBeInTheDocument();
  });

  it("formats a far-future date with the long Hebrew weekday/month form", () => {
    // Neither today nor tomorrow → hits the localized long-date branch.
    render(
      <BookingCard
        booking={makeBooking({ startTime: new Date("2099-12-25T08:30:00Z") } as never)}
      />,
    );
    // The long date includes a Hebrew month name ("בדצמבר").
    expect(screen.getByText(/בדצמבר/)).toBeInTheDocument();
  });

  it("renders the inactive (non-active) card styling for cancelled bookings", () => {
    render(<BookingCard booking={makeBooking({ status: "cancelled" } as never)} />);
    expect(screen.getByText("בוטל")).toBeInTheDocument();
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
  });
});
