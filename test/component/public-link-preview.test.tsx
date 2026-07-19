// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicLinkPreview } from "@/components/public-page/public-link-preview";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import { publicBusinessUrlClient } from "@/lib/config";

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("PublicLinkPreview", () => {
  it("renders the description, the full url and an open-in-new-tab link", () => {
    render(<PublicLinkPreview slug="studio-yofi" />);
    expect(
      screen.getByText(PUBLIC_PAGE.preview.description),
    ).toBeInTheDocument();
    // Always the canonical public URL, not the dashboard's current origin.
    expect(
      screen.getByText(publicBusinessUrlClient("studio-yofi")),
    ).toBeInTheDocument();

    const open = screen
      .getByText(PUBLIC_PAGE.preview.openButton)
      .closest("a")!;
    expect(open.getAttribute("href")).toBe(publicBusinessUrlClient("studio-yofi"));
    expect(open).toHaveAttribute("target", "_blank");
  });

  it("copies the full link and shows the copied confirmation", async () => {
    render(<PublicLinkPreview slug="studio-yofi" />);
    await userEvent.click(
      screen.getByRole("button", { name: PUBLIC_PAGE.preview.copyButton }),
    );
    expect(writeText).toHaveBeenCalledWith(
      publicBusinessUrlClient("studio-yofi"),
    );
    expect(screen.getByText(PUBLIC_PAGE.preview.copied)).toBeInTheDocument();
  });

  it("does not throw when the clipboard write rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<PublicLinkPreview slug="abc" />);
    await userEvent.click(
      screen.getByRole("button", { name: PUBLIC_PAGE.preview.copyButton }),
    );
    // copied state never flips after a rejection
    expect(
      screen.queryByText(PUBLIC_PAGE.preview.copied),
    ).not.toBeInTheDocument();
  });
});
