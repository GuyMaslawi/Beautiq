// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { WinBackClientCard } from "@/components/win-back-campaigns/win-back-client-card";
import type { WinBackClient } from "@/server/win-back-campaigns/queries";

// next/link → plain anchor so hrefs are inspectable.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

function makeClient(overrides: Partial<WinBackClient> = {}): WinBackClient {
  return {
    id: "c1",
    fullName: "דנה כהן",
    phone: "0501234567",
    lastVisitAt: new Date("2026-04-01T10:00:00Z"),
    lastServiceName: "מניקור ג'ל",
    daysSinceLastVisit: 45,
    totalCompletedBookings: 6,
    totalRevenue: 1200,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WinBackClientCard", () => {
  function renderCard(client = makeClient()) {
    return render(
      <WinBackClientCard
        client={client}
        campaignType="30"
        businessName="סטודיו יופי"
        lastVisitFormatted="1 באפריל 2026"
      />,
    );
  }

  it("renders client name, info rows and formatted ILS revenue", () => {
    renderCard();
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("1 באפריל 2026")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    // formatILS: ₪1,200
    expect(screen.getByText("₪1,200")).toBeInTheDocument();
    // days-ago badge
    expect(screen.getByText("לפני 45 ימים")).toBeInTheDocument();
  });

  it("renders a valid phone as a WhatsApp link (wa.me) and an open-WhatsApp action", () => {
    renderCard();
    const phoneLink = screen.getByText("0501234567").closest("a")!;
    expect(phoneLink.getAttribute("href")).toContain("wa.me/");
    expect(phoneLink.getAttribute("href")).toContain("972501234567");
    // Action link "פתיחה בוואטסאפ"
    const waAction = screen.getByText("פתיחה בוואטסאפ").closest("a")!;
    expect(waAction.getAttribute("href")).toContain("972501234567");
  });

  it("with an invalid phone shows a disabled (non-link) WhatsApp affordance", () => {
    renderCard(makeClient({ phone: "123" }));
    // phone is rendered as plain span, not a link
    const phoneEl = screen.getByText("123");
    expect(phoneEl.closest("a")).toBeNull();
    // The open-WhatsApp affordance is a disabled span, not an <a>
    const waText = screen.getByText("פתיחה בוואטסאפ");
    expect(waText.closest("a")).toBeNull();
    expect(waText.closest("span")).toHaveAttribute("title", "מספר טלפון לא תקין");
  });

  it("toggles the message preview open and closed", async () => {
    const user = userEvent.setup();
    renderCard();
    // preview hidden initially
    expect(screen.queryByText("הודעה מוצעת")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /הצגת הודעה/ }));
    expect(screen.getByText("הודעה מוצעת")).toBeInTheDocument();
    // now shows "סגירה" toggle
    await user.click(screen.getByRole("button", { name: /סגירה/ }));
    expect(screen.queryByText("הודעה מוצעת")).not.toBeInTheDocument();
  });

  it("copies the generated message to the clipboard and shows confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // userEvent.setup() installs its own clipboard stub, so override afterwards.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderCard();

    await user.click(screen.getByRole("button", { name: /העתקת הודעה/ }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(typeof writeText.mock.calls[0][0]).toBe("string");
    // After copy, shows "הועתק"
    expect(await screen.findByText("הועתק")).toBeInTheDocument();
  });

  it("links the new-booking and view-client actions to the right routes", () => {
    renderCard();
    const newBooking = screen.getByText("קביעת תור").closest("a")!;
    expect(newBooking.getAttribute("href")).toBe("/bookings/new?clientId=c1");
    const viewClient = screen.getByText("פרופיל לקוחה").closest("a")!;
    expect(viewClient.getAttribute("href")).toBe("/clients/c1");
  });

  it("does not throw when navigator.clipboard is undefined", async () => {
    const user = userEvent.setup();
    // Force the guarded branch: no clipboard available at click time.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    renderCard();
    await user.click(screen.getByRole("button", { name: /העתקת הודעה/ }));
    // No "הועתק" confirmation since clipboard path was skipped.
    expect(screen.queryByText("הועתק")).not.toBeInTheDocument();
  });

  it("renders the revenue with thousands separator for large amounts", () => {
    renderCard(makeClient({ totalRevenue: 25400 }));
    expect(within(document.body).getByText("₪25,400")).toBeInTheDocument();
  });
});
