// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AtRiskClientCard } from "@/components/at-risk/at-risk-client-card";
import { AT_RISK } from "@/lib/constants/he";
import type { AtRiskClient, RiskLevel } from "@/server/at-risk/queries";

function makeClient(overrides: Partial<AtRiskClient> = {}): AtRiskClient {
  return {
    id: "c1",
    fullName: "נועה כהן",
    phone: "0501234567",
    lastVisitAt: new Date("2026-01-01"),
    lastServiceName: "מניקור ג'ל",
    daysSinceLastVisit: 45,
    riskLevel: "medium" as RiskLevel,
    totalCompletedBookings: 8,
    totalRevenue: 1200,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AtRiskClientCard — base render", () => {
  it("renders name, risk badge, days-ago, last service, visits and revenue", () => {
    render(
      <AtRiskClientCard
        client={makeClient()}
        businessName="סטודיו יופי"
        lastVisitFormatted="1 בינואר"
      />,
    );
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText(AT_RISK.riskLevel.medium)).toBeInTheDocument();
    expect(screen.getByText(AT_RISK.card.daysAgo(45))).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("1 בינואר")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("₪1,200")).toBeInTheDocument();
  });

  it("renders the phone as a WhatsApp link when the phone is valid", () => {
    render(
      <AtRiskClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    const phoneLink = screen.getByRole("link", { name: "0501234567" });
    expect(phoneLink).toHaveAttribute("href", expect.stringContaining("wa.me/"));
    // The action button also exists.
    expect(screen.getByRole("link", { name: AT_RISK.card.openWhatsApp })).toBeInTheDocument();
  });

  it("renders a disabled WhatsApp action and plain phone for an invalid number", () => {
    render(
      <AtRiskClientCard
        client={makeClient({ phone: "123" })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    // No wa.me link — phone shown as plain text, action is a disabled span.
    expect(screen.queryByRole("link", { name: "123" })).not.toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: AT_RISK.card.openWhatsApp })).not.toBeInTheDocument();
    expect(screen.getByText(AT_RISK.card.openWhatsApp)).toBeInTheDocument();
  });
});

describe("AtRiskClientCard — risk-level warnings", () => {
  it("shows the critical warning copy for a critical client", () => {
    render(
      <AtRiskClientCard
        client={makeClient({ riskLevel: "critical", daysSinceLastVisit: 120 })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText(/לא חזרה יותר מ-90 יום/)).toBeInTheDocument();
  });

  it("shows the high warning copy for a high-risk client", () => {
    render(
      <AtRiskClientCard
        client={makeClient({ riskLevel: "high", daysSinceLastVisit: 70 })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText("הלקוחה לא חזרה יותר מ-60 יום")).toBeInTheDocument();
  });

  it("shows no warning hint for low/medium risk", () => {
    render(
      <AtRiskClientCard
        client={makeClient({ riskLevel: "low" })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.queryByText(/לא חזרה יותר מ/)).not.toBeInTheDocument();
  });
});

describe("AtRiskClientCard — message preview & copy", () => {
  it("toggles the message preview open and closed", async () => {
    render(
      <AtRiskClientCard
        client={makeClient()}
        businessName="סטודיו יופי"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.queryByText(AT_RISK.card.messageSectionTitle)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: new RegExp(AT_RISK.card.sendMessage) }));
    expect(screen.getByText(AT_RISK.card.messageSectionTitle)).toBeInTheDocument();
    // The generated message mentions the business and the missed-you copy.
    expect(screen.getByText(/התגעגענו/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: new RegExp(AT_RISK.card.closeMessage) }));
    expect(screen.queryByText(AT_RISK.card.messageSectionTitle)).not.toBeInTheDocument();
  });

  it("copies the message to clipboard and shows the copied state", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <AtRiskClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: AT_RISK.card.copyMessage }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(AT_RISK.card.messageCopied)).toBeInTheDocument();
  });

  it("does not throw when clipboard write rejects", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <AtRiskClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: AT_RISK.card.copyMessage }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    // Still shows the un-copied label (no crash).
    expect(screen.getByText(AT_RISK.card.copyMessage)).toBeInTheDocument();
  });
});

describe("AtRiskClientCard — navigation links", () => {
  it("links to new booking and client profile", () => {
    render(
      <AtRiskClientCard
        client={makeClient({ id: "abc" })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText(AT_RISK.card.newBooking).closest("a")).toHaveAttribute(
      "href",
      "/bookings/new?clientId=abc",
    );
    expect(screen.getByText(AT_RISK.card.viewClient).closest("a")).toHaveAttribute(
      "href",
      "/clients/abc",
    );
  });
});
