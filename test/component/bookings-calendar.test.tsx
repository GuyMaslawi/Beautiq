// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingsCalendar } from "@/components/bookings/bookings-calendar";
import type { CalendarBookingItem } from "@/server/bookings/queries";
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

// A fixed date used across tests for deterministic week/day math.
const CAL_DATE = "2026-06-17"; // a Wednesday

function makeBooking(overrides: Partial<CalendarBookingItem> = {}): CalendarBookingItem {
  return {
    id: "bk1",
    clientName: "נועה כהן",
    clientId: "c1",
    clientPhone: "0501234567",
    serviceName: "מניקור ג'ל",
    startTime: "2026-06-17T07:00:00.000Z", // 10:00 Israel time (UTC+3)
    endTime: "2026-06-17T08:00:00.000Z",
    status: "approved",
    priceSnapshot: 180,
    durationMinutesSnapshot: 60,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingsCalendar — toolbar + navigation", () => {
  it("renders the day-view range label, the 'היום' button and the new-booking link", () => {
    render(
      <BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="day" />,
    );
    expect(screen.getAllByText("היום").length).toBeGreaterThan(0);
    expect(screen.getByText("תור חדש")).toBeInTheDocument();
    expect(screen.getByText("יום")).toBeInTheDocument();
    expect(screen.getByText("שבוע")).toBeInTheDocument();
  });

  it("navigates to the previous day in day view", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="day" />);
    await user.click(screen.getByLabelText("הקודם"));
    expect(m.push).toHaveBeenCalledWith(
      expect.stringContaining("calDate=2026-06-16"),
    );
  });

  it("navigates to the next day in day view", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="day" />);
    await user.click(screen.getByLabelText("הבא"));
    expect(m.push).toHaveBeenCalledWith(
      expect.stringContaining("calDate=2026-06-18"),
    );
  });

  it("navigates a full week when in week view", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="week" />);
    await user.click(screen.getByLabelText("הבא"));
    expect(m.push).toHaveBeenCalledWith(
      expect.stringContaining("calDate=2026-06-24"),
    );
  });

  it("switches to week view via the week toggle", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="day" />);
    await user.click(screen.getByText("שבוע"));
    expect(m.push).toHaveBeenCalledWith(expect.stringContaining("calView=week"));
  });

  it("switches to day view via the day toggle", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="week" />);
    await user.click(screen.getByText("יום"));
    expect(m.push).toHaveBeenCalledWith(expect.stringContaining("calView=day"));
  });
});

describe("BookingsCalendar — empty state", () => {
  it("shows the day empty-state message when there are no bookings", () => {
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="day" />);
    expect(screen.getByText("אין תורים ביום הזה")).toBeInTheDocument();
    expect(screen.getByText("קביעת תור חדש")).toBeInTheDocument();
  });

  it("shows the week empty-state message in week view", () => {
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="week" />);
    expect(screen.getByText("אין תורים בשבוע הזה")).toBeInTheDocument();
  });
});

describe("BookingsCalendar — appointments + detail panel", () => {
  it("renders an appointment block for a booking on the visible day", () => {
    render(
      <BookingsCalendar
        bookings={[makeBooking()]}
        calDate={CAL_DATE}
        calView="day"
      />,
    );
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
  });

  it("opens the appointment detail panel when a block is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BookingsCalendar
        bookings={[makeBooking({ notes: "להגיע 5 דק׳ מוקדם" })]}
        calDate={CAL_DATE}
        calView="day"
      />,
    );

    // Click the appointment block (a button) — not the panel link, which is an anchor.
    const block = screen
      .getAllByRole("button", { name: /נועה כהן/ })
      .find((b) => b.tagName === "BUTTON")!;
    await user.click(block);

    // The panel is rendered for both desktop and mobile breakpoints in jsdom,
    // so detail content appears more than once.
    expect(screen.getAllByText("0501234567").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₪180").length).toBeGreaterThan(0);
    expect(screen.getAllByText("להגיע 5 דק׳ מוקדם").length).toBeGreaterThan(0);

    const detailLink = screen.getAllByText("לפרטי התור")[0].closest("a")!;
    expect(detailLink.getAttribute("href")).toBe("/bookings/bk1");
    const clientLink = screen.getAllByText("פרופיל לקוח")[0].closest("a")!;
    expect(clientLink.getAttribute("href")).toBe("/clients/c1");
  });

  it("closes the detail panel via its close button", async () => {
    const user = userEvent.setup();
    render(
      <BookingsCalendar
        bookings={[makeBooking()]}
        calDate={CAL_DATE}
        calView="day"
      />,
    );
    const block = screen
      .getAllByRole("button", { name: /נועה כהן/ })
      .find((b) => b.tagName === "BUTTON")!;
    await user.click(block);
    expect(screen.getAllByText("לפרטי התור").length).toBeGreaterThan(0);

    // The close button sits in the panel header next to the client name.
    // Walk up from the first panel's detail link to the panel root, then click
    // its header close button.
    const panel = screen.getAllByText("לפרטי התור")[0].closest(
      ".flex.flex-col",
    )!;
    const closeBtn = within(panel as HTMLElement).getAllByRole("button")[0];
    await user.click(closeBtn);
    expect(screen.queryByText("לפרטי התור")).not.toBeInTheDocument();
  });

  it("hides the phone row in the panel when there is no client phone", async () => {
    const user = userEvent.setup();
    render(
      <BookingsCalendar
        bookings={[makeBooking({ clientPhone: "" })]}
        calDate={CAL_DATE}
        calView="day"
      />,
    );
    const block = screen
      .getAllByRole("button", { name: /נועה כהן/ })
      .find((b) => b.tagName === "BUTTON")!;
    await user.click(block);
    expect(screen.queryByText("0501234567")).not.toBeInTheDocument();
  });
});

describe("BookingsCalendar — week view header", () => {
  it("renders the seven Hebrew weekday headers and a numeric day cell in week view", async () => {
    const user = userEvent.setup();
    render(<BookingsCalendar bookings={[]} calDate={CAL_DATE} calView="week" />);

    // All seven short Hebrew day letters appear in the week header.
    for (const day of ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }

    // Clicking the Sunday (14) header navigates to that day in day view.
    await user.click(screen.getByText("14"));
    expect(m.push).toHaveBeenCalledWith(
      expect.stringContaining("calDate=2026-06-14"),
    );
  });
});
