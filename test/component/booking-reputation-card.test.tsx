// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BookingReputationCard } from "@/components/reputation/booking-reputation-card";
import { REPUTATION } from "@/lib/constants/he";

const writeText = vi.fn<(text: string) => Promise<void>>(() =>
  Promise.resolve(),
);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

function renderCard(isToday = true) {
  return render(
    <BookingReputationCard
      clientName="דנה"
      serviceName="מניקור ג'ל"
      businessName="סטודיו יופי"
      isToday={isToday}
    />,
  );
}

describe("BookingReputationCard", () => {
  it("renders the header and both action buttons, no panel initially", () => {
    renderCard();
    expect(screen.getByText("מוניטין וביקורות")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: REPUTATION.card.reviewButton }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(REPUTATION.message.copyButton),
    ).not.toBeInTheDocument();
  });

  it("opens the thank-you panel with the today message", async () => {
    renderCard(true);
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    expect(
      screen.getByText(REPUTATION.message.thankyouTitle, { selector: "p" }),
    ).toBeInTheDocument();
    // today phrasing includes "תודה שהגעת היום"
    expect(
      screen.getByText(/תודה שהגעת היום ל־מניקור ג'ל אצל סטודיו יופי/),
    ).toBeInTheDocument();
  });

  it("opens the thank-you panel with the non-today message", async () => {
    renderCard(false);
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    expect(
      screen.getByText(/תודה שהגעת ל־מניקור ג'ל אצל סטודיו יופי/),
    ).toBeInTheDocument();
  });

  it("opens the review panel with the review request message", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.reviewButton }),
    );
    expect(
      screen.getByText(/נשמח מאוד לביקורת קצרה/),
    ).toBeInTheDocument();
  });

  it("copies the active message and shows the copied confirmation", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.thankyouButton }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/תודה שהגעת היום/);
    expect(
      screen.getByText(`✓ ${REPUTATION.message.copied}`),
    ).toBeInTheDocument();
  });

  it("toggles a panel closed when the same button is pressed again", async () => {
    renderCard();
    const btn = screen.getByRole("button", {
      name: REPUTATION.card.thankyouButton,
    });
    await userEvent.click(btn);
    expect(screen.getByText(REPUTATION.message.copyButton)).toBeInTheDocument();
    await userEvent.click(btn);
    expect(
      screen.queryByText(REPUTATION.message.copyButton),
    ).not.toBeInTheDocument();
  });

  it("closes the panel via the close button", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.reviewButton }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.close }),
    );
    expect(
      screen.queryByText(REPUTATION.message.copyButton),
    ).not.toBeInTheDocument();
  });

  it("does not throw when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.card.reviewButton }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    );
    // copied state never flips because clipboard was absent
    expect(
      screen.queryByText(`✓ ${REPUTATION.message.copied}`),
    ).not.toBeInTheDocument();
  });
});
