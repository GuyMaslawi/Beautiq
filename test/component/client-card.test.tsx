// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientCard } from "@/components/clients/client-card";
import { CLIENTS } from "@/lib/constants/he";
import type { ClientListItem } from "@/server/clients/queries";

// The WhatsApp modal child imports these server actions — mock so the module
// graph resolves without a real server runtime.
vi.mock("@/server/clients/whatsapp-actions", () => ({
  sendManualClientWhatsAppAction: vi.fn(),
}));
vi.mock("@/server/admin/client-actions", () => ({
  adminSendManualClientWhatsAppAction: vi.fn(),
}));

function makeClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "c1",
    fullName: "נועה כהן",
    phone: "0501234567",
    email: null,
    lastVisitAt: null,
    upcomingBooking: null,
    totalBookings: 0,
    noShowCount: 0,
    cancellationCount: 0,
    totalSpent: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientCard — base render", () => {
  it("renders name, phone, initials and the action links", () => {
    render(<ClientCard client={makeClient()} />);

    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("0501234567")).toBeInTheDocument();
    // Initials = first letters of the two name words.
    expect(screen.getByText("נכ")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: CLIENTS.card.detailsButton })).toHaveAttribute(
      "href",
      "/clients/c1",
    );
    expect(screen.getByRole("link", { name: CLIENTS.card.newBookingButton })).toHaveAttribute(
      "href",
      "/bookings/new?clientId=c1",
    );
  });

  it("shows a dash for last visit and spend when there is no data", () => {
    render(<ClientCard client={makeClient()} />);
    // lastVisit and totalSpent both render "—".
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT render the WhatsApp button without a businessName", () => {
    render(<ClientCard client={makeClient()} />);
    expect(screen.queryByRole("button", { name: "WhatsApp" })).not.toBeInTheDocument();
  });

  it("renders the WhatsApp trigger button when businessName is provided", () => {
    render(<ClientCard client={makeClient()} businessName="סטודיו יופי" />);
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
  });
});

describe("ClientCard — status tones & badges", () => {
  it("shows the upcoming-booking highlight and 'תור קרוב' status when there is an upcoming booking", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0);
    render(
      <ClientCard
        client={makeClient({
          upcomingBooking: { id: "b1", startTime: today, serviceName: "מניקור" },
        })}
      />,
    );
    expect(screen.getByText("תור קרוב")).toBeInTheDocument();
    // Highlight chip shows the formatted upcoming date (today label).
    expect(screen.getByText(/היום ·/)).toBeInTheDocument();
  });

  it("shows the no-show status label and the no-show/cancellation badges", () => {
    render(
      <ClientCard client={makeClient({ noShowCount: 2, cancellationCount: 1 })} />,
    );
    expect(screen.getByText("לא הגיעה")).toBeInTheDocument();
    expect(screen.getByText(`${CLIENTS.card.noShow}: 2`)).toBeInTheDocument();
    expect(screen.getByText(`${CLIENTS.card.cancellations}: 1`)).toBeInTheDocument();
  });

  it("renders populated stats (last visit, totals, spend)", () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 1);
    render(
      <ClientCard
        client={makeClient({
          lastVisitAt: lastWeek,
          totalBookings: 5,
          totalSpent: 1200,
        })}
      />,
    );
    expect(screen.getByText("אתמול")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("₪1,200")).toBeInTheDocument();
  });

  it("formats 'today' and 'days ago' last-visit labels", () => {
    const today = new Date();
    const { unmount } = render(<ClientCard client={makeClient({ lastVisitAt: today })} />);
    expect(screen.getByText("היום")).toBeInTheDocument();
    unmount();

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    render(<ClientCard client={makeClient({ lastVisitAt: threeDaysAgo })} />);
    expect(screen.getByText("לפני 3 ימים")).toBeInTheDocument();
  });

  it("formats a tomorrow upcoming-booking label", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    render(
      <ClientCard
        client={makeClient({
          upcomingBooking: { id: "b1", startTime: tomorrow, serviceName: "פדיקור" },
        })}
      />,
    );
    expect(screen.getByText(/מחר ·/)).toBeInTheDocument();
  });

  it("formats a far-future upcoming-booking label (weekday/day/month)", () => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    render(
      <ClientCard
        client={makeClient({
          upcomingBooking: { id: "b1", startTime: future, serviceName: "פדיקור" },
        })}
      />,
    );
    // Neither today nor tomorrow — long-form date with the time separator.
    expect(screen.queryByText(/היום ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/מחר ·/)).not.toBeInTheDocument();
  });

  it("formats an older last-visit (>=7 days) as a day/month date", () => {
    const old = new Date();
    old.setDate(old.getDate() - 40);
    render(<ClientCard client={makeClient({ lastVisitAt: old })} />);
    expect(screen.queryByText("היום")).not.toBeInTheDocument();
    expect(screen.queryByText(/לפני .* ימים/)).not.toBeInTheDocument();
  });
});
