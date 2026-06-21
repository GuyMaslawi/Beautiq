// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicLinkCard } from "@/components/settings/public-link-card";
import { SETTINGS } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PublicLinkCard", () => {
  it("renders the active badge, body and the public URL from window.origin", () => {
    render(<PublicLinkCard slug="studio-yofi" />);
    expect(screen.getByText(SETTINGS.publicLink.active)).toBeInTheDocument();
    expect(screen.getByText(SETTINGS.publicLink.body)).toBeInTheDocument();
    expect(screen.getByText(SETTINGS.publicLink.slugLabel)).toBeInTheDocument();
    expect(
      screen.getByText(`${window.location.origin}/b/studio-yofi`),
    ).toBeInTheDocument();
  });

  function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  }

  it("copies the URL to the clipboard and shows the 'copied' label, then reverts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub — override it after.
    stubClipboard(writeText);

    render(<PublicLinkCard slug="studio-yofi" />);

    const btn = screen.getByRole("button", { name: SETTINGS.publicLink.copyButton });
    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/b/studio-yofi`);
    expect(
      await screen.findByRole("button", { name: SETTINGS.publicLink.copied }),
    ).toBeInTheDocument();

    // After 2s it reverts back to the copy label.
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: SETTINGS.publicLink.copyButton }),
        ).toBeInTheDocument(),
      { timeout: 2500 },
    );
  });

  it("silently ignores a clipboard failure (no crash, label stays as copy)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    stubClipboard(writeText);

    render(<PublicLinkCard slug="abc" />);
    await user.click(
      screen.getByRole("button", { name: SETTINGS.publicLink.copyButton }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    // Still shows the copy label because the copy threw.
    expect(
      screen.getByRole("button", { name: SETTINGS.publicLink.copyButton }),
    ).toBeInTheDocument();
  });
});
