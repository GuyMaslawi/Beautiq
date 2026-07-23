// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VisibilityForm } from "@/components/public-page/visibility-form";
import { PUBLIC_PAGE } from "@/lib/constants/he";

// The visibility form auto-saves each toggle the moment it is flipped (no
// separate save button). `action(field, value)` persists a single field and
// returns `{ error }` on failure so the client can revert.

const ALL_ON = {
  showServices: true,
  showPrices: true,
  showHours: true,
  showReviews: true,
  showGallery: true,
  showPhone: true,
  showAddress: true,
};

const action = vi.fn(async () => ({}) as { error?: string });

beforeEach(() => {
  vi.clearAllMocks();
  action.mockResolvedValue({});
});

function renderForm(initialValues = ALL_ON) {
  return render(
    <VisibilityForm action={action} initialValues={initialValues} />,
  );
}

describe("VisibilityForm", () => {
  it("renders all seven toggle labels", () => {
    renderForm();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showServices)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showPrices)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showHours)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showPhone)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showAddress)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showGallery)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_PAGE.visibility.showReviews)).toBeInTheDocument();
  });

  it("reflects the initial values on the switches", () => {
    renderForm({ ...ALL_ON, showPrices: false });
    expect(
      screen.getByRole("switch", { name: PUBLIC_PAGE.visibility.showPrices }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("switch", { name: PUBLIC_PAGE.visibility.showServices }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("saves instantly on toggle: calls the action with (field, nextValue) and shows saved", async () => {
    renderForm();
    const priceSwitch = screen.getByRole("switch", {
      name: PUBLIC_PAGE.visibility.showPrices,
    });
    expect(priceSwitch).toHaveAttribute("aria-checked", "true");

    await userEvent.click(priceSwitch);

    // Optimistic flip + persisted with the new value.
    expect(priceSwitch).toHaveAttribute("aria-checked", "false");
    expect(action).toHaveBeenCalledWith("showPrices", false);

    // The per-toggle "saved" indicator appears once the action resolves.
    expect(await screen.findByText(PUBLIC_PAGE.visibility.saved)).toBeInTheDocument();
  });

  it("reverts the switch and shows an error when the save fails", async () => {
    action.mockResolvedValueOnce({ error: "שגיאה בשמירה" });
    renderForm();
    const priceSwitch = screen.getByRole("switch", {
      name: PUBLIC_PAGE.visibility.showPrices,
    });

    await userEvent.click(priceSwitch);

    // On failure the optimistic change is rolled back and the error surfaces.
    await waitFor(() =>
      expect(priceSwitch).toHaveAttribute("aria-checked", "true"),
    );
    expect(screen.getByText("שגיאה בשמירה")).toBeInTheDocument();
  });

  it("renders the auto-save hint", () => {
    renderForm();
    expect(screen.getByText(PUBLIC_PAGE.visibility.hint)).toBeInTheDocument();
  });
});
