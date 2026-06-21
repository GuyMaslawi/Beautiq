// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// next/link → plain anchor so hrefs are inspectable.
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

const writeText = vi.fn(() => Promise.resolve());

import React from "react";
import { ReputationBookingCard } from "@/components/reputation/reputation-booking-card";
import { REPUTATION } from "@/lib/constants/he";
import type { ReputationBooking } from "@/server/reputation/queries";

function makeBooking(overrides: Partial<ReputationBooking> = {}): ReputationBooking {
  return {
    id: "bk-1",
    clientId: "cl-1",
    clientName: "דנה",
    clientPhone: "050-1234567",
    serviceName: "מניקור ג'ל",
    completedAt: new Date("2026-06-10T10:00:00Z"),
    price: 150,
    isToday: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

function renderCard(overrides: Partial<ReputationBooking> = {}) {
  return render(
    <ReputationBookingCard
      booking={makeBooking(overrides)}
      businessName="סטודיו יופי"
      completedDateFormatted="10 ביוני 2026"
    />,
  );
}

describe("ReputationBookingCard", () => {
  it("renders client, phone, service, formatted date and completed badge", () => {
    renderCard();
    expect(screen.getByText("דנה")).toBeInTheDocument();
    expect(screen.getByText("050-1234567")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("10 ביוני 2026")).toBeInTheDocument();
    expect(screen.getByText(REPUTATION.card.completedBadge)).toBeInTheDocument();
  });

  it("renders the price line when price > 0 and hides it at 0", () => {
    const { rerender } = renderCard({ price: 150 });
    expect(screen.getByText("₪150")).toBeInTheDocument();

    rerender(
      <ReputationBookingCard
        booking={makeBooking({ price: 0 })}
        businessName="סטודיו יופי"
        completedDateFormatted="10 ביוני 2026"
      />,
    );
    expect(screen.queryByText(/^₪/)).not.toBeInTheDocument();
  });

  it("links to booking and client detail pages", () => {
    renderCard();
    const bookingLink = screen
      .getByText(REPUTATION.card.bookingDetails)
      .closest("a")!;
    const clientLink = screen
      .getByText(REPUTATION.card.clientDetails)
      .closest("a")!;
    expect(bookingLink.getAttribute("href")).toBe("/bookings/bk-1");
    expect(clientLink.getAttribute("href")).toBe("/clients/cl-1");
  });

  it("opens the thank-you message preview (today wording)", async () => {
    renderCard({ isToday: true });
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    expect(
      screen.getByText(/תודה שהגעת היום ל־מניקור ג'ל אצל סטודיו יופי/),
    ).toBeInTheDocument();
  });

  it("opens the review message preview and toggles it closed", async () => {
    renderCard();
    const reviewBtn = screen.getByRole("button", {
      name: REPUTATION.card.reviewButton,
    });
    await userEvent.click(reviewBtn);
    expect(screen.getByText(/נשמח מאוד לביקורת קצרה/)).toBeInTheDocument();

    // pressing review again toggles the panel closed
    await userEvent.click(reviewBtn);
    expect(
      screen.queryByText(/נשמח מאוד לביקורת קצרה/),
    ).not.toBeInTheDocument();
  });

  it("switches from thank-you to review when the other button is pressed", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    expect(screen.getByText(REPUTATION.message.thankyouTitle, { selector: "p" })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.reviewButton }),
    );
    expect(screen.getByText(REPUTATION.message.reviewTitle, { selector: "p" })).toBeInTheDocument();
  });

  it("closes the preview via its close button", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.close }),
    );
    expect(
      screen.queryByText(REPUTATION.message.thankyouTitle, { selector: "p" }),
    ).not.toBeInTheDocument();
  });
});
