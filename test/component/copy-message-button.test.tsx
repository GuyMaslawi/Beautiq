// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyMessageButton } from "@/components/messages/copy-message-button";

const writeText = vi.fn(() => Promise.resolve());

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

/**
 * userEvent.setup() installs its OWN navigator.clipboard stub, so our spy must
 * be installed AFTER setup() to win. This helper returns a configured user with
 * our clipboard spy in place.
 */
function makeUser() {
  const user = userEvent.setup();
  setClipboard({ writeText });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  setClipboard({ writeText });
});

describe("CopyMessageButton", () => {
  it("renders the label and copies the message to the clipboard", async () => {
    const user = makeUser();
    render(<CopyMessageButton message="הודעת וואטסאפ" label="העתקה" />);
    const btn = screen.getByRole("button", { name: "העתקה" });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(writeText).toHaveBeenCalledWith("הודעת וואטסאפ");
    // After success, the label switches to the success copy.
    expect(await screen.findByText(/✓/)).toBeInTheDocument();
  });

  it("shows the fallback textarea when clipboard is unavailable", async () => {
    const user = userEvent.setup();
    // Remove clipboard entirely → triggers the fallback branch.
    setClipboard(undefined);
    render(<CopyMessageButton message="טקסט גיבוי" label="העתקה" />);
    await user.click(screen.getByRole("button", { name: "העתקה" }));
    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveValue("טקסט גיבוי");
  });

  it("shows the fallback textarea when writeText rejects", async () => {
    const user = userEvent.setup();
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error("denied"))) });
    render(<CopyMessageButton message="טקסט נכשל" label="העתקה" />);
    await user.click(screen.getByRole("button", { name: "העתקה" }));
    expect(await screen.findByRole("textbox")).toHaveValue("טקסט נכשל");
  });

  it("selects the fallback textarea content on click", async () => {
    const user = userEvent.setup();
    setClipboard(undefined);
    render(<CopyMessageButton message="לבחירה" label="העתקה" />);
    await user.click(screen.getByRole("button", { name: "העתקה" }));
    const textarea = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    const select = vi.fn();
    textarea.select = select;
    await user.click(textarea);
    expect(select).toHaveBeenCalled();
  });

  it("resets the success label after the timeout", async () => {
    vi.useFakeTimers();
    try {
      render(<CopyMessageButton message="m" label="העתקה" />);
      const btn = screen.getByRole("button");
      // Click synchronously (fake timers): drive the async handler manually.
      await act(async () => {
        btn.click();
        await Promise.resolve();
      });
      expect(screen.getByRole("button").textContent).toContain("✓");
      await act(async () => {
        vi.advanceTimersByTime(2600);
      });
      expect(screen.getByRole("button").textContent).toBe("העתקה");
    } finally {
      vi.useRealTimers();
    }
  });
});
