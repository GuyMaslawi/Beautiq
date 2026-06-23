// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Drive useActionState so the formError/success branches are reachable.
const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  isPending: false,
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [h.state, vi.fn(), h.isPending] as const,
  };
});

import { VisibilityForm } from "@/components/public-page/visibility-form";
import { PUBLIC_PAGE } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  h.state = {};
  h.isPending = false;
});

const ALL_ON = {
  showServices: true,
  showPrices: true,
  showHours: true,
  showReviews: true,
  showGallery: true,
  showPhone: true,
  showAddress: true,
};

const action = vi.fn(async () => ({}));

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

  it("reflects the initial values in the hidden inputs", () => {
    renderForm({ ...ALL_ON, showPrices: false });
    const priceInput = document.querySelector(
      'input[name="showPrices"]',
    ) as HTMLInputElement;
    expect(priceInput.value).toBe("false");
    const servicesInput = document.querySelector(
      'input[name="showServices"]',
    ) as HTMLInputElement;
    expect(servicesInput.value).toBe("true");
  });

  it("toggles a switch and updates its backing hidden input", async () => {
    renderForm();
    const priceSwitch = screen.getByRole("switch", {
      name: PUBLIC_PAGE.visibility.showPrices,
    });
    expect(priceSwitch).toHaveAttribute("aria-checked", "true");

    await userEvent.click(priceSwitch);
    expect(priceSwitch).toHaveAttribute("aria-checked", "false");
    const priceInput = document.querySelector(
      'input[name="showPrices"]',
    ) as HTMLInputElement;
    expect(priceInput.value).toBe("false");
  });

  it("renders the save button label, and the saving label while pending", () => {
    const { unmount } = renderForm();
    expect(
      screen.getByRole("button", { name: PUBLIC_PAGE.visibility.saveButton }),
    ).toBeEnabled();
    unmount();

    h.isPending = true;
    renderForm();
    const btn = screen.getByRole("button", {
      name: PUBLIC_PAGE.visibility.saving,
    });
    expect(btn).toBeDisabled();
  });

  it("renders the form error alert", () => {
    h.state = { formError: "שגיאה בשמירה" };
    renderForm();
    expect(screen.getByText("שגיאה בשמירה")).toBeInTheDocument();
  });

  it("renders the success message", () => {
    h.state = { success: PUBLIC_PAGE.visibility.success };
    renderForm();
    expect(
      screen.getByText(PUBLIC_PAGE.visibility.success),
    ).toBeInTheDocument();
  });
});
