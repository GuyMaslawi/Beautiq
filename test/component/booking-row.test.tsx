// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingRow } from "@/components/bookings/booking-row";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingListItem } from "@/server/bookings/queries";
import React from "react";

const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...rest }, children),
}));
vi.mock("@/server/bookings/actions", () => ({
  approveBookingAction: vi.fn(async () => {}),
  completeBookingAction: vi.fn(async () => {}),
  cancelBookingAction: vi.fn(async () => {}),
  noShowBookingAction: vi.fn(async () => {}),
}));
vi.mock("motion/react", async () => {
  const r = await import("react");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      r.createElement(r.Fragment, null, children),
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

function renderRow(
  booking: BookingListItem,
  lateCancellationHours: number | null = null,
) {
  return render(
    <table>
      <tbody>
        <BookingRow booking={booking} lateCancellationHours={lateCancellationHours} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingRow — core content", () => {
  it("renders client, service, phone, duration, price and status", () => {
    renderRow(makeBooking());
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("0501234567")).toBeInTheDocument();
    expect(screen.getByText("דק׳ 60")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByText("מאושר")).toBeInTheDocument();
  });

  it("links the client cell to the booking detail page", () => {
    renderRow(makeBooking({ id: "bk-42" } as never));
    const link = screen.getByText("נועה כהן").closest("a")!;
    expect(link.getAttribute("href")).toBe("/bookings/bk-42");
  });

  it("renders an em-dash when the price is zero", () => {
    renderRow(makeBooking({ priceSnapshot: 0 } as never));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/₪/)).not.toBeInTheDocument();
  });
});

describe("BookingRow — reminder badge", () => {
  it("shows 'תזכורת נשלחה' when a reminder was sent on an active booking", () => {
    renderRow(makeBooking({ reminderSentAt: new Date() } as never));
    expect(screen.getByText("תזכורת נשלחה")).toBeInTheDocument();
  });

  it("hides the reminder badge for a completed booking", () => {
    renderRow(
      makeBooking({ status: "completed", reminderSentAt: new Date() } as never),
    );
    expect(screen.queryByText("תזכורת נשלחה")).not.toBeInTheDocument();
  });
});

describe("BookingRow — late cancellation badges", () => {
  it("shows the late-cancellation badge when cancelled past the deadline", () => {
    renderRow(
      makeBooking({
        status: "cancelled",
        startTime: new Date("2099-12-25T10:00:00Z"),
        // cancelled 1h before start, deadline = 24h before → late
        cancelledAt: new Date("2099-12-25T09:00:00Z"),
      } as never),
      24,
    );
    expect(
      screen.getByText(BOOKINGS.lateCancellation.badgeLate),
    ).toBeInTheDocument();
  });

  it("shows the on-time badge when cancelled before the deadline", () => {
    renderRow(
      makeBooking({
        status: "cancelled",
        startTime: new Date("2099-12-25T10:00:00Z"),
        cancelledAt: new Date("2099-12-20T09:00:00Z"),
      } as never),
      24,
    );
    expect(
      screen.getByText(BOOKINGS.lateCancellation.badgeOnTime),
    ).toBeInTheDocument();
  });

  it("renders no late-cancellation badge when the policy hours are null", () => {
    renderRow(
      makeBooking({ status: "cancelled", cancelledAt: new Date() } as never),
      null,
    );
    expect(
      screen.queryByText(BOOKINGS.lateCancellation.badgeLate),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(BOOKINGS.lateCancellation.badgeOnTime),
    ).not.toBeInTheDocument();
  });

  it("uses noShowAt for late detection on no-show bookings", () => {
    renderRow(
      makeBooking({
        status: "no_show",
        startTime: new Date("2099-12-25T10:00:00Z"),
        noShowAt: new Date("2099-12-25T09:30:00Z"),
      } as never),
      24,
    );
    expect(
      screen.getByText(BOOKINGS.lateCancellation.badgeLate),
    ).toBeInTheDocument();
  });
});

describe("BookingRow — cancellation fee badge", () => {
  it("shows the fee badge as paid", () => {
    renderRow(
      makeBooking({
        status: "cancelled",
        lateCancellationFeeStatus: "paid",
      } as never),
    );
    expect(
      screen.getByText(
        new RegExp(BOOKINGS.lateCancellation.feeStatusPaid),
      ),
    ).toBeInTheDocument();
  });

  it("shows the fee badge as pending", () => {
    renderRow(
      makeBooking({
        status: "cancelled",
        lateCancellationFeeStatus: "pending",
      } as never),
    );
    expect(
      screen.getByText(
        new RegExp(BOOKINGS.lateCancellation.feeStatusPending),
      ),
    ).toBeInTheDocument();
  });
});

describe("BookingRow — date labels", () => {
  it("shows 'היום' for a booking today", () => {
    const today = new Date();
    today.setHours(11, 0, 0, 0);
    renderRow(makeBooking({ startTime: today } as never));
    expect(screen.getByText("היום")).toBeInTheDocument();
  });

  it("shows 'מחר' for a booking tomorrow", () => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(11, 0, 0, 0);
    renderRow(makeBooking({ startTime: tomorrow } as never));
    expect(screen.getByText("מחר")).toBeInTheDocument();
  });

  it("highlights a pending booking row (pending-approval styling branch)", () => {
    renderRow(makeBooking({ status: "pending" } as never));
    expect(screen.getByText("ממתין לאישור")).toBeInTheDocument();
  });
});
