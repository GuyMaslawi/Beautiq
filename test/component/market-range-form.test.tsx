// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// useActionState is mocked so we control the form `state` and can assert the
// success-effect calls onSaved. The real bound action is never invoked.
const h = vi.hoisted(() => ({
  state: { success: false } as Record<string, unknown>,
  isPending: false,
  formAction: vi.fn(),
  bind: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [h.state, h.formAction, h.isPending] as const,
  };
});

vi.mock("@/server/pricing/actions", () => ({
  saveMarketRangeAction: { bind: () => h.bind },
}));

import { MarketRangeForm } from "@/components/pricing/market-range-form";
import { PRICING } from "@/lib/constants/he";

beforeEach(() => {
  vi.clearAllMocks();
  h.state = {};
  h.isPending = false;
});

function renderForm(onSaved = vi.fn(), state: Record<string, unknown> = {}) {
  h.state = state;
  return { onSaved, ...render(
    <MarketRangeForm
      serviceId="svc-1"
      marketMinPrice={120}
      marketAveragePrice={null}
      marketMaxPrice={250}
      onSaved={onSaved}
    />,
  ) };
}

describe("MarketRangeForm", () => {
  it("renders the three labelled price inputs with hint and defaults", () => {
    renderForm();
    expect(screen.getByText(PRICING.marketRange.hint)).toBeInTheDocument();
    expect(screen.getByText(PRICING.marketRange.minLabel)).toBeInTheDocument();
    expect(screen.getByText(PRICING.marketRange.avgLabel)).toBeInTheDocument();
    expect(screen.getByText(PRICING.marketRange.maxLabel)).toBeInTheDocument();

    const min = document.querySelector(
      'input[name="marketMinPrice"]',
    ) as HTMLInputElement;
    const avg = document.querySelector(
      'input[name="marketAveragePrice"]',
    ) as HTMLInputElement;
    const max = document.querySelector(
      'input[name="marketMaxPrice"]',
    ) as HTMLInputElement;
    expect(min.value).toBe("120");
    // null default coerces to an empty string (no "null" leaks into the field).
    expect(avg.value).toBe("");
    expect(max.value).toBe("250");
  });

  it("shows the save button label and the form is submittable", async () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: PRICING.marketRange.saveButton }),
    ).toBeEnabled();
  });

  it("shows the saving label and disables the button while pending", () => {
    h.isPending = true;
    render(
      <MarketRangeForm
        serviceId="svc-1"
        marketMinPrice={null}
        marketAveragePrice={null}
        marketMaxPrice={null}
        onSaved={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", {
      name: PRICING.marketRange.saving,
    });
    expect(btn).toBeDisabled();
  });

  it("renders per-field errors when fieldErrors are present", () => {
    renderForm(vi.fn(), {
      fieldErrors: { min: "שגיאה מינ", avg: "שגיאה ממוצע", max: "שגיאה מקס" },
    });
    expect(screen.getByText("שגיאה מינ")).toBeInTheDocument();
    expect(screen.getByText("שגיאה ממוצע")).toBeInTheDocument();
    expect(screen.getByText("שגיאה מקס")).toBeInTheDocument();
  });

  it("renders a general form error", () => {
    renderForm(vi.fn(), { formError: "שגיאה כללית" });
    expect(screen.getByText("שגיאה כללית")).toBeInTheDocument();
  });

  it("renders the saved confirmation and calls onSaved exactly once on success", () => {
    const onSaved = vi.fn();
    const { rerender } = render(
      <MarketRangeForm
        serviceId="svc-1"
        marketMinPrice={null}
        marketAveragePrice={null}
        marketMaxPrice={null}
        onSaved={onSaved}
      />,
    );
    expect(onSaved).not.toHaveBeenCalled();

    h.state = { success: true };
    rerender(
      <MarketRangeForm
        serviceId="svc-1"
        marketMinPrice={null}
        marketAveragePrice={null}
        marketMaxPrice={null}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByText(PRICING.marketRange.saved)).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledTimes(1);

    // A further re-render with success still true must not double-fire onSaved.
    rerender(
      <MarketRangeForm
        serviceId="svc-1"
        marketMinPrice={null}
        marketAveragePrice={null}
        marketMaxPrice={null}
        onSaved={onSaved}
      />,
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("lets the user type into the price inputs", async () => {
    renderForm();
    const min = document.querySelector(
      'input[name="marketMinPrice"]',
    ) as HTMLInputElement;
    await userEvent.clear(min);
    await userEvent.type(min, "99");
    expect(min.value).toBe("99");
  });
});
