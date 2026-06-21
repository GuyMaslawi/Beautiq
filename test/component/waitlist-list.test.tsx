// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ setWaitlistStatusAction: vi.fn(() => Promise.resolve()) }));
vi.mock("@/server/waitlist/actions", () => ({
  setWaitlistStatusAction: m.setWaitlistStatusAction,
}));

import { WaitlistList } from "@/components/waitlist/waitlist-list";
import type { WaitlistEntryItem } from "@/server/waitlist/queries";

beforeEach(() => {
  vi.clearAllMocks();
});

function entry(over: Partial<WaitlistEntryItem> = {}): WaitlistEntryItem {
  return {
    id: "w1",
    clientId: "c1",
    clientName: "עדי כהן",
    clientPhone: "0501234567",
    serviceId: "s1",
    serviceName: "לק ג׳ל",
    preferredFrom: new Date("2026-06-20T07:00:00Z"),
    preferredTo: new Date("2026-06-20T10:00:00Z"),
    notes: "מעדיפה אחר הצהריים",
    status: "active",
    createdAt: new Date("2026-06-15T08:00:00Z"),
    ...over,
  };
}

describe("WaitlistList", () => {
  it("renders the empty state when there are no entries", () => {
    render(<WaitlistList entries={[]} />);
    expect(screen.getByText("אין לקוחות ברשימת ההמתנה")).toBeInTheDocument();
  });

  it("renders an active entry with its name, service, status and notes", () => {
    render(<WaitlistList entries={[entry()]} />);
    expect(screen.getByText("עדי כהן")).toBeInTheDocument();
    expect(screen.getByText("לק ג׳ל")).toBeInTheDocument();
    expect(screen.getByText("ממתינה")).toBeInTheDocument();
    expect(screen.getByText("מעדיפה אחר הצהריים")).toBeInTheDocument();
  });

  it("builds a wa.me message link for the active client", () => {
    render(<WaitlistList entries={[entry()]} />);
    const link = screen.getByRole("link", { name: /שלחי הודעה/ });
    const href = link.getAttribute("href")!;
    expect(href).toMatch(/^https:\/\/wa\.me\/\+?972501234567\?text=/);
    expect(decodeURIComponent(href)).toContain("את ברשימת ההמתנה");
  });

  it("calls setWaitlistStatusAction with 'notified' from mark-contacted", async () => {
    const user = userEvent.setup();
    render(<WaitlistList entries={[entry()]} />);
    await user.click(screen.getByRole("button", { name: /נוצר קשר/ }));
    expect(m.setWaitlistStatusAction).toHaveBeenCalledWith("w1", "notified");
  });

  it("calls the action with 'booked' and 'cancelled' from the other actions", async () => {
    const user = userEvent.setup();
    render(<WaitlistList entries={[entry()]} />);
    await user.click(screen.getByRole("button", { name: /נקבע תור/ }));
    expect(m.setWaitlistStatusAction).toHaveBeenCalledWith("w1", "booked");
    await user.click(screen.getByRole("button", { name: /הסרה/ }));
    expect(m.setWaitlistStatusAction).toHaveBeenCalledWith("w1", "cancelled");
  });

  it("hides the action row for a terminal (booked) entry", () => {
    render(<WaitlistList entries={[entry({ id: "w2", status: "booked" })]} />);
    expect(screen.getByText("נקבע תור")).toBeInTheDocument(); // status pill
    expect(screen.queryByRole("button", { name: /הסרה/ })).not.toBeInTheDocument();
  });

  it("shows 'any service' and 'flexible time' fallbacks", () => {
    render(
      <WaitlistList
        entries={[
          entry({
            id: "w3",
            serviceName: null,
            preferredFrom: null,
            preferredTo: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("כל שירות")).toBeInTheDocument();
    expect(screen.getByText("גמיש")).toBeInTheDocument();
  });

  it("renders an all-day preferred window as just the date", () => {
    render(
      <WaitlistList
        entries={[
          entry({
            id: "w4",
            // 00:00–23:59 Jerusalem → date only
            preferredFrom: new Date("2026-06-19T21:00:00Z"),
            preferredTo: new Date("2026-06-20T20:59:00Z"),
          }),
        ]}
      />,
    );
    // The "·" time-range separator should be absent for the all-day case.
    const row = screen.getByText("עדי כהן").closest("div")!.parentElement!.parentElement!;
    expect(within(row).queryByText(/–/)).not.toBeInTheDocument();
  });
});
