// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingRow } from "@/components/bookings/booking-row";
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

function renderRow(booking: BookingListItem) {
  return render(
    <table>
      <tbody>
        <BookingRow booking={booking} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingRow — core content", () => {
  it("renders client, service, phone, duration and price", () => {
    renderRow(makeBooking());
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("0501234567")).toBeInTheDocument();
    expect(screen.getByText("דק׳ 60")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    // Active bookings carry no status badge — nothing to approve.
    expect(screen.queryByText("מאושר")).not.toBeInTheDocument();
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

  it("shows no status badge for an active (pending/approved) booking row", () => {
    renderRow(makeBooking({ status: "pending" } as never));
    expect(screen.queryByText("ממתין לאישור")).not.toBeInTheDocument();
    expect(screen.queryByText("מאושר")).not.toBeInTheDocument();
  });
});
