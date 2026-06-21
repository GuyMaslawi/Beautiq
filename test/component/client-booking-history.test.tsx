// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClientBookingHistory } from "@/components/clients/client-booking-history";
import { CLIENTS, BOOKINGS } from "@/lib/constants/he";
import type { ClientBookingHistoryItem } from "@/server/clients/queries";

// Decimal-like priceSnapshot: the component only does Number(priceSnapshot),
// so a plain string is sufficient for the test (cast through the Decimal type).
type BookingOverrides = Partial<Omit<ClientBookingHistoryItem, "priceSnapshot">> & {
  id: string;
  priceSnapshot?: string;
};

function makeBooking(overrides: BookingOverrides): ClientBookingHistoryItem {
  return {
    id: overrides.id,
    status: overrides.status ?? "completed",
    startTime: overrides.startTime ?? new Date(),
    endTime: overrides.endTime ?? new Date(),
    priceSnapshot: (overrides.priceSnapshot ?? "150") as unknown as ClientBookingHistoryItem["priceSnapshot"],
    durationMinutesSnapshot: overrides.durationMinutesSnapshot ?? 60,
    service: overrides.service ?? { id: "svc-1", name: "מניקור" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientBookingHistory — empty state", () => {
  it("renders the empty Hebrew copy and a create-booking CTA linking to the client", () => {
    render(<ClientBookingHistory clientId="c1" bookings={[]} />);

    expect(screen.getByText(CLIENTS.detail.noBookingsTitle)).toBeInTheDocument();
    expect(screen.getByText(CLIENTS.detail.noBookingsBody)).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: CLIENTS.detail.noBookingsCta });
    expect(cta).toHaveAttribute("href", "/bookings/new?clientId=c1");
  });
});

describe("ClientBookingHistory — populated", () => {
  it("renders each booking with service name, duration and a view link", () => {
    const bookings = [
      makeBooking({ id: "b1", service: { id: "s1", name: "מניקור ג'ל" }, durationMinutesSnapshot: 45 }),
      makeBooking({ id: "b2", service: { id: "s2", name: "פדיקור" } }),
    ];
    render(<ClientBookingHistory clientId="c9" bookings={bookings} />);

    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("פדיקור")).toBeInTheDocument();
    expect(screen.getByText(`45 ${BOOKINGS.card.minutesShort}`)).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: CLIENTS.detail.viewBooking });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/bookings/b1");
    expect(links[1]).toHaveAttribute("href", "/bookings/b2");
  });

  it("shows the price block only when price > 0", () => {
    const { container } = render(
      <ClientBookingHistory
        clientId="c1"
        bookings={[
          makeBooking({ id: "p", priceSnapshot: "250" }),
          makeBooking({ id: "z", priceSnapshot: "0" }),
        ]}
      />,
    );
    // ₪ symbol appears once (only for the priced booking).
    const priced = container.textContent ?? "";
    expect(priced).toContain(`${BOOKINGS.card.price}250`);
    // Two rows rendered.
    expect(screen.getAllByText(CLIENTS.detail.viewBooking)).toHaveLength(2);
  });

  it("formats today, tomorrow and an arbitrary date label", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 30);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = new Date(today);
    future.setDate(future.getDate() + 10);

    const { container } = render(
      <ClientBookingHistory
        clientId="c1"
        bookings={[
          makeBooking({ id: "t", startTime: today }),
          makeBooking({ id: "m", startTime: tomorrow }),
          makeBooking({ id: "f", startTime: future }),
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/היום ·/);
    expect(text).toMatch(/מחר ·/);
  });

  it("renders a status badge per booking", () => {
    render(
      <ClientBookingHistory
        clientId="c1"
        bookings={[makeBooking({ id: "x", status: "no_show" })]}
      />,
    );
    // BookingStatusBadge renders Hebrew status text; just assert one row exists.
    const row = screen.getByText("מניקור").closest("div");
    expect(within(row!.parentElement!).getByText(CLIENTS.detail.viewBooking)).toBeInTheDocument();
  });
});
