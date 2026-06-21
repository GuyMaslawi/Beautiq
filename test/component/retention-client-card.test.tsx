// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetentionClientCard } from "@/components/retention/retention-client-card";
import { RETENTION } from "@/lib/constants/he";
import type { RetentionClient } from "@/server/retention/queries";

function makeClient(overrides: Partial<RetentionClient> = {}): RetentionClient {
  return {
    id: "c1",
    fullName: "מיה לוי",
    phone: "0521234567",
    lastCompletedBookingAt: new Date("2026-01-01"),
    lastServiceName: "פדיקור",
    daysSinceLastVisit: 50,
    totalCompletedBookings: 4,
    hasNoShow: false,
    hasCancellations: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RetentionClientCard — base render", () => {
  it("renders name, phone, days-since, last service, last visit and total visits", () => {
    render(
      <RetentionClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="1 בינואר"
      />,
    );
    expect(screen.getByText("מיה לוי")).toBeInTheDocument();
    expect(screen.getByText("0521234567")).toBeInTheDocument();
    expect(screen.getByText(RETENTION.card.daysSince(50))).toBeInTheDocument();
    expect(screen.getByText("פדיקור")).toBeInTheDocument();
    expect(screen.getByText("1 בינואר")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders the navigation links to new booking and profile", () => {
    render(
      <RetentionClientCard
        client={makeClient({ id: "xyz" })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText(RETENTION.card.newBooking).closest("a")).toHaveAttribute(
      "href",
      "/bookings/new?clientId=xyz",
    );
    expect(screen.getByText(RETENTION.card.viewDetails).closest("a")).toHaveAttribute(
      "href",
      "/clients/xyz",
    );
  });
});

describe("RetentionClientCard — hint badges", () => {
  it("shows no hint badges when there are no no-shows / cancellations", () => {
    render(
      <RetentionClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.queryByText(RETENTION.card.noShowHint)).not.toBeInTheDocument();
    expect(screen.queryByText(RETENTION.card.cancellationHint)).not.toBeInTheDocument();
  });

  it("shows the no-show hint", () => {
    render(
      <RetentionClientCard
        client={makeClient({ hasNoShow: true })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText(RETENTION.card.noShowHint)).toBeInTheDocument();
  });

  it("shows the cancellation hint", () => {
    render(
      <RetentionClientCard
        client={makeClient({ hasCancellations: true })}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.getByText(RETENTION.card.cancellationHint)).toBeInTheDocument();
  });
});

describe("RetentionClientCard — message preview & copy", () => {
  it("toggles the message preview open and closed", async () => {
    render(
      <RetentionClientCard
        client={makeClient()}
        businessName="סטודיו"
        lastVisitFormatted="x"
      />,
    );
    expect(screen.queryByText(RETENTION.message.sectionTitle)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(RETENTION.card.prepareMessage) }),
    );
    expect(screen.getByText(RETENTION.message.sectionTitle)).toBeInTheDocument();
    // The message preview contains the retention copy with the service name.
    expect(screen.getByText(/עבר זמן מה מאז התור האחרון/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(RETENTION.message.close) }),
    );
    expect(screen.queryByText(RETENTION.message.sectionTitle)).not.toBeInTheDocument();
  });

  it("copies the message and shows the copied state", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <RetentionClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(RETENTION.card.prepareMessage) }),
    );
    await userEvent.click(screen.getByRole("button", { name: RETENTION.message.copyButton }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(`✓ ${RETENTION.message.copied}`)).toBeInTheDocument();
  });

  it("does not throw when clipboard write rejects", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("no")));
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <RetentionClientCard
        client={makeClient()}
        businessName="עסק"
        lastVisitFormatted="x"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(RETENTION.card.prepareMessage) }),
    );
    await userEvent.click(screen.getByRole("button", { name: RETENTION.message.copyButton }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByText(RETENTION.message.copyButton)).toBeInTheDocument();
  });
});
