// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReputationMessagePreview } from "@/components/reputation/reputation-message-preview";
import { REPUTATION } from "@/lib/constants/he";

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("ReputationMessagePreview", () => {
  it("renders the title and message text", () => {
    render(
      <ReputationMessagePreview
        title="כותרת הודעה"
        message="שלום וברכה"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("כותרת הודעה")).toBeInTheDocument();
    expect(screen.getByText("שלום וברכה")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    ).toBeInTheDocument();
  });

  it("copies the message and shows the copied label", async () => {
    render(
      <ReputationMessagePreview
        title="כותרת"
        message="טקסט להעתקה"
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    );
    expect(writeText).toHaveBeenCalledWith("טקסט להעתקה");
    expect(
      screen.getByText(`✓ ${REPUTATION.message.copied}`),
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is pressed", async () => {
    const onClose = vi.fn();
    render(
      <ReputationMessagePreview title="כותרת" message="טקסט" onClose={onClose} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.close }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("swallows a clipboard write rejection without flipping copied", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(
      <ReputationMessagePreview title="כותרת" message="טקסט" onClose={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    );
    expect(
      screen.queryByText(`✓ ${REPUTATION.message.copied}`),
    ).not.toBeInTheDocument();
  });

  it("does not throw or flip copied when clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    render(
      <ReputationMessagePreview title="כותרת" message="טקסט" onClose={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: REPUTATION.message.copyButton }),
    );
    expect(
      screen.queryByText(`✓ ${REPUTATION.message.copied}`),
    ).not.toBeInTheDocument();
  });
});
