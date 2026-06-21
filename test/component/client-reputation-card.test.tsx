// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ClientReputationCard } from "@/components/reputation/client-reputation-card";
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

function renderCard(isToday = false) {
  return render(
    <ClientReputationCard
      clientName="מיכל"
      serviceName="פדיקור"
      businessName="מכון יופי"
      isToday={isToday}
    />,
  );
}

describe("ClientReputationCard", () => {
  it("renders the title, body and both action buttons", () => {
    renderCard();
    expect(screen.getByText(REPUTATION.clientCard.title)).toBeInTheDocument();
    expect(screen.getByText(REPUTATION.clientCard.body)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: REPUTATION.clientCard.thankyouAction }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: REPUTATION.clientCard.reviewAction }),
    ).toBeInTheDocument();
  });

  it("opens the thank-you panel (non-today message)", async () => {
    renderCard(false);
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.thankyouAction }),
    );
    expect(
      screen.getByText(REPUTATION.message.thankyouTitle, { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/תודה שהגעת ל־פדיקור אצל מכון יופי/),
    ).toBeInTheDocument();
  });

  it("opens the thank-you panel (today message)", async () => {
    renderCard(true);
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.thankyouAction }),
    );
    expect(
      screen.getByText(/תודה שהגעת היום ל־פדיקור אצל מכון יופי/),
    ).toBeInTheDocument();
  });

  it("opens the review panel and copies, showing the copied confirmation", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.reviewAction }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.copyButton }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/נשמח מאוד לביקורת קצרה/);
    expect(
      screen.getByText(`✓ ${REPUTATION.clientCard.copied}`),
    ).toBeInTheDocument();
  });

  it("toggles a panel closed when its button is pressed twice", async () => {
    renderCard();
    const btn = screen.getByRole("button", {
      name: REPUTATION.clientCard.reviewAction,
    });
    await userEvent.click(btn);
    expect(
      screen.getByText(REPUTATION.clientCard.copyButton),
    ).toBeInTheDocument();
    await userEvent.click(btn);
    expect(
      screen.queryByText(REPUTATION.clientCard.copyButton),
    ).not.toBeInTheDocument();
  });

  it("closes the panel via the close button", async () => {
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.thankyouAction }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.close }),
    );
    expect(
      screen.queryByText(REPUTATION.clientCard.copyButton),
    ).not.toBeInTheDocument();
  });

  it("handles a missing clipboard gracefully", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    renderCard();
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.thankyouAction }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.clientCard.copyButton }),
    );
    expect(
      screen.queryByText(`✓ ${REPUTATION.clientCard.copied}`),
    ).not.toBeInTheDocument();
  });
});
