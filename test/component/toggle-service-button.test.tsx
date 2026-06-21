// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToggleServiceButton } from "@/components/services/toggle-service-button";
import { SERVICES } from "@/lib/constants/he";

const m = vi.hoisted(() => ({ toggle: vi.fn(async () => ({ success: true })) }));
vi.mock("@/server/services/actions", () => ({
  toggleServiceActiveAction: m.toggle,
}));

beforeEach(() => {
  vi.clearAllMocks();
  m.toggle.mockResolvedValue({ success: true });
});

describe("ToggleServiceButton", () => {
  it("reflects the active state with the 'פעיל' label and a checked switch", () => {
    render(<ToggleServiceButton serviceId="s1" isActive />);
    expect(screen.getByText(SERVICES.card.active)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("reflects the inactive state with the 'כבוי' label", () => {
    render(<ToggleServiceButton serviceId="s1" isActive={false} />);
    expect(screen.getByText(SERVICES.card.inactive)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls the toggle action with the next state when switched on", async () => {
    const user = userEvent.setup();
    render(<ToggleServiceButton serviceId="svc-9" isActive={false} />);

    await user.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(m.toggle).toHaveBeenCalledWith("svc-9", true),
    );
    // Optimistically switched to active
    expect(screen.getByText(SERVICES.card.active)).toBeInTheDocument();
  });

  it("reverts the switch and shows an error when the action fails, then clears it", async () => {
    m.toggle.mockResolvedValue({ success: false });
    const user = userEvent.setup();
    render(<ToggleServiceButton serviceId="s1" isActive />);

    await user.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(screen.getByText(SERVICES.card.toggleError)).toBeInTheDocument(),
    );
    // Reverted back to the active label after the failure.
    expect(screen.getByText(SERVICES.card.active)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    // Error auto-clears after the 3s timeout.
    await waitFor(
      () =>
        expect(
          screen.queryByText(SERVICES.card.toggleError),
        ).not.toBeInTheDocument(),
      { timeout: 4000 },
    );
  }, 6000);

  it("exposes an accessible label that matches the current state", () => {
    const { unmount } = render(<ToggleServiceButton serviceId="s1" isActive />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "כיבוי שירות");
    unmount();

    render(<ToggleServiceButton serviceId="s1" isActive={false} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "הפעלת שירות");
  });
});
