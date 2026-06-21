// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientRetentionCard } from "@/components/retention/client-retention-card";
import { RETENTION } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientRetentionCard", () => {
  it("renders the profile card title, body and the toggle action (message hidden initially)", () => {
    render(<ClientRetentionCard clientName="נועה" businessName="עסק" />);

    expect(screen.getByText(RETENTION.clientProfileCard.title)).toBeInTheDocument();
    expect(screen.getByText(RETENTION.clientProfileCard.body)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    ).toBeInTheDocument();
    expect(screen.queryByText(RETENTION.message.sectionTitle)).not.toBeInTheDocument();
  });

  it("opens the message preview with the service-specific message", async () => {
    render(
      <ClientRetentionCard
        clientName="נועה"
        businessName="סטודיו יופי"
        lastServiceName="מניקור"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    );
    expect(screen.getByText(RETENTION.message.sectionTitle)).toBeInTheDocument();
    // withService message mentions the service name.
    expect(screen.getByText(/מניקור/)).toBeInTheDocument();
  });

  it("opens the message preview with the no-service message when none is given", async () => {
    render(<ClientRetentionCard clientName="נועה" businessName="עסק" />);
    await userEvent.click(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    );
    // No-service message variant: mentions the business but no service name.
    expect(screen.getByText(/עבר זמן מה מאז התור האחרון שלך אצל עסק/)).toBeInTheDocument();
  });

  it("closes the message preview again", async () => {
    render(<ClientRetentionCard clientName="נועה" businessName="עסק" />);
    await userEvent.click(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    );
    await userEvent.click(screen.getByRole("button", { name: RETENTION.message.close }));
    expect(screen.queryByText(RETENTION.message.sectionTitle)).not.toBeInTheDocument();
  });

  it("copies the message and shows the copied state", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ClientRetentionCard clientName="נועה" businessName="עסק" />);
    await userEvent.click(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    );
    await userEvent.click(screen.getByRole("button", { name: RETENTION.message.copyButton }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(`✓ ${RETENTION.message.copied}`)).toBeInTheDocument();
  });

  it("does not throw when clipboard write rejects", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("no")));
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ClientRetentionCard clientName="נועה" businessName="עסק" />);
    await userEvent.click(
      screen.getByRole("button", { name: RETENTION.clientProfileCard.action }),
    );
    await userEvent.click(screen.getByRole("button", { name: RETENTION.message.copyButton }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByText(RETENTION.message.copyButton)).toBeInTheDocument();
  });
});
