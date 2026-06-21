// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BusinessCategoriesForm } from "@/components/settings/business-categories-form";
import { SETTINGS } from "@/lib/constants/he";
import type { BusinessCategoryData } from "@/server/settings/queries";

const CATEGORIES: BusinessCategoryData[] = [
  { id: "c1", key: "nails", nameHe: "ציפורניים" },
  { id: "c2", key: "lashes", nameHe: "ריסים" },
  { id: "c3", key: "hair", nameHe: "שיער" },
];

function renderForm(opts: {
  action?: ReturnType<typeof vi.fn>;
  selectedIds?: string[];
} = {}) {
  const action =
    opts.action ?? vi.fn(async () => ({}) as Record<string, unknown>);
  render(
    <BusinessCategoriesForm
      // The action type is a server action; the mock satisfies the runtime call.
      action={action as never}
      allCategories={CATEGORIES}
      selectedIds={opts.selectedIds ?? []}
    />,
  );
  return { action };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BusinessCategoriesForm", () => {
  it("renders the hint, all category chips and the save button", () => {
    renderForm();
    expect(screen.getByText(SETTINGS.categories.hint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ציפורניים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ריסים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "שיער" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: SETTINGS.categories.saveButton }),
    ).toBeInTheDocument();
  });

  it("pre-selects the provided ids and renders hidden inputs for them", () => {
    const { container } = render(
      <BusinessCategoriesForm
        action={(vi.fn(async () => ({})) as never)}
        allCategories={CATEGORIES}
        selectedIds={["c1"]}
      />,
    );
    const hidden = container.querySelectorAll('input[name="categoryIds"]');
    expect(hidden.length).toBe(1);
    expect((hidden[0] as HTMLInputElement).value).toBe("c1");
    // The selected chip carries the "selected" styling (white text on primary).
    expect(screen.getByRole("button", { name: "ציפורניים" }).className).toContain(
      "text-white",
    );
  });

  it("toggles a chip on and off, updating the hidden inputs", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BusinessCategoriesForm
        action={(vi.fn(async () => ({})) as never)}
        allCategories={CATEGORIES}
        selectedIds={[]}
      />,
    );
    expect(container.querySelectorAll('input[name="categoryIds"]').length).toBe(0);

    await user.click(screen.getByRole("button", { name: "ריסים" }));
    const hidden = container.querySelectorAll('input[name="categoryIds"]');
    expect(hidden.length).toBe(1);
    expect((hidden[0] as HTMLInputElement).value).toBe("c2");

    // Toggle off again.
    await user.click(screen.getByRole("button", { name: "ריסים" }));
    expect(container.querySelectorAll('input[name="categoryIds"]').length).toBe(0);
  });

  it("submits the selected categories to the action", async () => {
    const action = vi.fn(async () => ({}));
    const user = userEvent.setup();
    render(
      <BusinessCategoriesForm
        action={action as never}
        allCategories={CATEGORIES}
        selectedIds={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "ציפורניים" }));
    await user.click(screen.getByRole("button", { name: "שיער" }));
    await user.click(
      screen.getByRole("button", { name: SETTINGS.categories.saveButton }),
    );
    await waitFor(() => expect(action).toHaveBeenCalled());
    const fd = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.getAll("categoryIds").map(String).sort()).toEqual(["c1", "c3"]);
  });

  it("renders a form-level error returned from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ formError: "משהו השתבש" }));
    render(
      <BusinessCategoriesForm
        action={action as never}
        allCategories={CATEGORIES}
        selectedIds={[]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: SETTINGS.categories.saveButton }),
    );
    expect(await screen.findByText("משהו השתבש")).toBeInTheDocument();
  });

  it("renders the success message returned from the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ success: SETTINGS.categories.success }));
    render(
      <BusinessCategoriesForm
        action={action as never}
        allCategories={CATEGORIES}
        selectedIds={[]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: SETTINGS.categories.saveButton }),
    );
    expect(
      await screen.findByText(SETTINGS.categories.success),
    ).toBeInTheDocument();
  });
});
