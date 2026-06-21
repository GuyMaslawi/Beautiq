// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import React from "react";
import {
  BringBackHub,
  type BringBackClientSerialized,
} from "@/components/bring-back/bring-back-hub";
import type { BringBackSummary } from "@/server/bring-back/queries";

const writeText = vi.fn(() => Promise.resolve());
function makeUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

const summary: BringBackSummary = { total: 1, critical: 1, high: 0, medium: 0 };

function client(over: Partial<BringBackClientSerialized> = {}): BringBackClientSerialized {
  return {
    id: "c1",
    fullName: "דנה לוי",
    phone: "0501234567",
    lastVisitAtISO: "2026-01-01T00:00:00.000Z",
    lastServiceName: "לק ג׳ל",
    daysSinceLastVisit: 120,
    segment: "critical",
    totalCompletedBookings: 5,
    totalRevenue: 1200,
    ...over,
  };
}

describe("BringBackHub", () => {
  it("renders the empty state when there are no clients", () => {
    render(
      <BringBackHub clients={[]} summary={summary} thresholdDays={60} businessName="הסטודיו" />,
    );
    expect(screen.getByText("לקוחות שלא חזרו")).toBeInTheDocument();
    // PremiumEmptyState title from BRING_BACK.emptyState
    expect(
      screen.getByText("כרגע אין לקוחות שצריך להחזיר — מעולה!"),
    ).toBeInTheDocument();
  });

  it("renders a client card with name, count badge and revenue", () => {
    render(
      <BringBackHub
        clients={[client()]}
        summary={summary}
        thresholdDays={60}
        businessName="הסטודיו"
      />,
    );
    expect(screen.getByText("דנה לוי")).toBeInTheDocument();
    // count badge
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/לא ביקרה 120 ימים/)).toBeInTheDocument();
  });

  it("links 'קבעי תור' to the new-booking page with the client id", () => {
    render(
      <BringBackHub
        clients={[client()]}
        summary={summary}
        thresholdDays={60}
        businessName="הסטודיו"
      />,
    );
    const link = screen.getByRole("link", { name: /קבעי תור/ });
    expect(link.getAttribute("href")).toBe("/bookings/new?clientId=c1");
  });

  it("expands the message panel, builds the message, applies an offer and copies", async () => {
    const user = makeUser();
    render(
      <BringBackHub
        clients={[client()]}
        summary={summary}
        thresholdDays={60}
        businessName="הסטודיו"
      />,
    );
    await user.click(screen.getByRole("button", { name: /שלחי הודעה/ }));
    // Base message renders with client + service + business
    expect(
      screen.getByText(/עבר זמן מה מאז הטיפול האחרון שלך בלק ג׳ל אצל הסטודיו/),
    ).toBeInTheDocument();

    // Apply a discount offer → it appears in the preview
    await user.click(screen.getByRole("button", { name: "10% הנחה לתור הבא" }));
    expect(screen.getByText(/מגיעה לך הנחה של 10%/)).toBeInTheDocument();

    // Copy
    await user.click(screen.getByRole("button", { name: /העתקי הודעה לשליחה בוואטסאפ/ }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText(/הועתק/)).toBeInTheDocument();
  });

  it("links to the client profile from the expanded panel", async () => {
    const user = makeUser();
    render(
      <BringBackHub
        clients={[client()]}
        summary={summary}
        thresholdDays={60}
        businessName="הסטודיו"
      />,
    );
    await user.click(screen.getByRole("button", { name: /שלחי הודעה/ }));
    const profile = screen.getByRole("link", { name: /פרופיל לקוחה/ });
    expect(profile.getAttribute("href")).toBe("/clients/c1");
  });

  it("uses the right segment label per segment", () => {
    render(
      <BringBackHub
        clients={[client({ id: "h", segment: "high", daysSinceLastVisit: 70 })]}
        summary={summary}
        thresholdDays={60}
        businessName="הסטודיו"
      />,
    );
    expect(screen.getByText("דחוף · 60+ ימים")).toBeInTheDocument();
  });
});
