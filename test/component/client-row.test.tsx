// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientRow } from "@/components/clients/client-row";
import { CLIENTS, ACTIONS } from "@/lib/constants/he";
import type { ClientListItem } from "@/server/clients/queries";

vi.mock("@/server/clients/whatsapp-actions", () => ({
  sendManualClientWhatsAppAction: vi.fn(),
}));
vi.mock("@/server/admin/client-actions", () => ({
  adminSendManualClientWhatsAppAction: vi.fn(),
}));

function makeClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "c1",
    fullName: "מיה לוי",
    phone: "0521234567",
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

function renderRow(client: ClientListItem) {
  // A <tr> must live inside a table for valid DOM.
  return render(
    <table>
      <tbody>
        <ClientRow client={client} businessName="עסק" isTestMode={false} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientRow", () => {
  it("renders name, phone, initials, and the action links", () => {
    renderRow(makeClient());

    expect(screen.getByText("מיה לוי")).toBeInTheDocument();
    expect(screen.getByText("0521234567")).toBeInTheDocument();
    expect(screen.getByText("מל")).toBeInTheDocument();

    const detailLinks = screen.getAllByRole("link", { name: CLIENTS.card.detailsButton });
    expect(detailLinks[0]).toHaveAttribute("href", "/clients/c1");
    expect(screen.getByRole("link", { name: ACTIONS.edit })).toHaveAttribute("href", "/clients/c1");
    expect(screen.getByRole("link", { name: "+ תור" })).toHaveAttribute(
      "href",
      "/bookings/new?clientId=c1",
    );
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeInTheDocument();
  });

  it("marks clients without a last visit as 'חדש' and shows 'no visit yet'", () => {
    renderRow(makeClient({ lastVisitAt: null }));
    expect(screen.getByText("חדש")).toBeInTheDocument();
    expect(screen.getByText(CLIENTS.card.noVisitYet)).toBeInTheDocument();
  });

  it("marks a recently-seen client (< 30 days) as 'חדש'", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);
    renderRow(makeClient({ lastVisitAt: recent }));
    expect(screen.getByText("חדש")).toBeInTheDocument();
    expect(screen.getByText("לפני 5 ימים")).toBeInTheDocument();
  });

  it("does NOT mark an old client (>= 30 days) as 'חדש'", () => {
    const old = new Date();
    old.setDate(old.getDate() - 60);
    renderRow(makeClient({ lastVisitAt: old }));
    expect(screen.queryByText("חדש")).not.toBeInTheDocument();
  });

  it("shows 'אין תור קרוב' when there is no upcoming booking", () => {
    renderRow(makeClient());
    expect(screen.getByText("אין תור קרוב")).toBeInTheDocument();
  });

  it("shows the upcoming booking date when present (today)", () => {
    const today = new Date();
    today.setHours(15, 30, 0, 0);
    renderRow(
      makeClient({
        upcomingBooking: { id: "b1", startTime: today, serviceName: "מניקור" },
      }),
    );
    expect(screen.getByText(/היום ·/)).toBeInTheDocument();
  });

  it("shows the tomorrow upcoming label", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    renderRow(
      makeClient({
        upcomingBooking: { id: "b1", startTime: tomorrow, serviceName: "x" },
      }),
    );
    expect(screen.getByText(/מחר ·/)).toBeInTheDocument();
  });

  it("renders no-show + cancellation badges, else a dash", () => {
    const { unmount } = renderRow(makeClient({ noShowCount: 1, cancellationCount: 2 }));
    expect(screen.getByText(`${CLIENTS.card.noShow}: 1`)).toBeInTheDocument();
    expect(screen.getByText(`${CLIENTS.card.cancellations}: 2`)).toBeInTheDocument();
    unmount();

    renderRow(makeClient());
    // History column dash present (along with total spent dash).
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders total spend when > 0 and a dash otherwise", () => {
    const { unmount } = renderRow(makeClient({ totalSpent: 980 }));
    expect(screen.getByText("₪980")).toBeInTheDocument();
    expect(screen.getByText("סה״כ הוצאה")).toBeInTheDocument();
    unmount();

    renderRow(makeClient({ totalSpent: 0 }));
    expect(screen.queryByText("סה״כ הוצאה")).not.toBeInTheDocument();
  });

  it("formats 'today' and 'weeks ago' last-visit labels", () => {
    const today = new Date();
    const { unmount } = renderRow(makeClient({ lastVisitAt: today }));
    expect(screen.getByText("היום")).toBeInTheDocument();
    unmount();

    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() - 14);
    renderRow(makeClient({ lastVisitAt: twoWeeks }));
    expect(screen.getByText("לפני 2 שבועות")).toBeInTheDocument();
  });

  it("formats 'yesterday' last-visit label", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderRow(makeClient({ lastVisitAt: yesterday }));
    expect(screen.getByText("אתמול")).toBeInTheDocument();
  });

  it("renders the total bookings count", () => {
    renderRow(makeClient({ totalBookings: 7 }));
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("formats a far-future upcoming booking (weekday/day/month, not today/tomorrow)", () => {
    const future = new Date();
    future.setDate(future.getDate() + 12);
    future.setHours(11, 0, 0, 0);
    renderRow(
      makeClient({
        upcomingBooking: { id: "b1", startTime: future, serviceName: "x" },
      }),
    );
    expect(screen.queryByText(/היום ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/מחר ·/)).not.toBeInTheDocument();
    // The "←" prefix marks the upcoming line.
    expect(screen.getByText(/←/)).toBeInTheDocument();
  });

  it("formats an old last-visit (>= 30 days) as a day/month date, not 'weeks ago'", () => {
    const old = new Date();
    old.setDate(old.getDate() - 45);
    renderRow(makeClient({ lastVisitAt: old }));
    expect(screen.queryByText(/לפני .* שבועות/)).not.toBeInTheDocument();
    expect(screen.queryByText("היום")).not.toBeInTheDocument();
  });
});
