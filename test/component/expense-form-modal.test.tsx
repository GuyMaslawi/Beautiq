// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { ExpenseItem } from "@/server/finance/queries";

// The action results drive useActionState. We control them per-test via the
// mocked action implementations, which receive (prevState, formData).
const m = vi.hoisted(() => ({
  addExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
}));

vi.mock("@/server/finance/actions", () => ({
  addExpenseAction: m.addExpenseAction,
  updateExpenseAction: m.updateExpenseAction,
}));

import { ExpenseFormModal } from "@/components/finance/expense-form-modal";

function makeExpense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "e1",
    description: "שכירות",
    category: "rent",
    date: "2026-06-01",
    amount: 1500,
    notes: "חודש יוני",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.addExpenseAction.mockResolvedValue({});
  m.updateExpenseAction.mockResolvedValue({});
});

describe("ExpenseFormModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<ExpenseFormModal open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the add title and empty fields when no expense is supplied", () => {
    render(<ExpenseFormModal open expense={null} onClose={vi.fn()} />);
    expect(screen.getByText("הוספת הוצאה")).toBeInTheDocument();
    expect(screen.getByText("בחרי קטגוריה…")).toBeInTheDocument();
    // category options from FINANCE.categories
    expect(screen.getByRole("option", { name: "שכירות" })).toBeInTheDocument();
    // date defaults to today (no hidden expenseId input in add mode)
    expect(document.querySelector('input[name="expenseId"]')).toBeNull();
  });

  it("renders the edit title, prefilled values and a hidden expenseId in edit mode", () => {
    render(<ExpenseFormModal open expense={makeExpense()} onClose={vi.fn()} />);
    expect(screen.getByText("עריכת הוצאה")).toBeInTheDocument();
    expect((document.querySelector('input[name="description"]') as HTMLInputElement).value).toBe("שכירות");
    expect((document.querySelector('input[name="amount"]') as HTMLInputElement).value).toBe("1500");
    expect((document.querySelector('select[name="category"]') as HTMLSelectElement).value).toBe("rent");
    const hidden = document.querySelector('input[name="expenseId"]') as HTMLInputElement;
    expect(hidden.value).toBe("e1");
  });

  it("submitting in add mode dispatches addExpenseAction", async () => {
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={null} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("לדוגמה: שכירות למשרד"), "ציוד חדש");
    await user.click(screen.getByRole("button", { name: "שמירת הוצאה" }));
    await waitFor(() => expect(m.addExpenseAction).toHaveBeenCalled());
    expect(m.updateExpenseAction).not.toHaveBeenCalled();
  });

  it("submitting in edit mode dispatches updateExpenseAction", async () => {
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={makeExpense()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "שמירת הוצאה" }));
    await waitFor(() => expect(m.updateExpenseAction).toHaveBeenCalled());
    expect(m.addExpenseAction).not.toHaveBeenCalled();
  });

  it("renders field-level validation errors and a form error from the action result", async () => {
    m.addExpenseAction.mockResolvedValue({
      formError: "משהו השתבש. יש לנסות שוב בעוד רגע",
      errors: { description: "יש למלא תיאור", amount: "הסכום אינו תקין", date: "יש לבחור תאריך", category: "יש לבחור קטגוריה" },
    });
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={null} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "שמירת הוצאה" }));
    expect(await screen.findByText("משהו השתבש. יש לנסות שוב בעוד רגע")).toBeInTheDocument();
    expect(screen.getByText("יש למלא תיאור")).toBeInTheDocument();
    expect(screen.getByText("הסכום אינו תקין")).toBeInTheDocument();
    expect(screen.getByText("יש לבחור תאריך")).toBeInTheDocument();
    expect(screen.getByText("יש לבחור קטגוריה")).toBeInTheDocument();
  });

  it("calls onClose when the action reports success", async () => {
    m.addExpenseAction.mockResolvedValue({ success: "ההוצאה נוספה בהצלחה" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={null} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "שמירת הוצאה" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("calls onClose from the X button and the cancel button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={null} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "סגירה" }));
    await user.click(screen.getByRole("button", { name: "ביטול" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when the backdrop (overlay container) is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<ExpenseFormModal open expense={null} onClose={onClose} />);
    // outermost fixed overlay is the click target whose currentTarget===target
    const overlay = container.firstElementChild as HTMLElement;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when clicking inside the panel", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseFormModal open expense={null} onClose={onClose} />);
    await user.click(screen.getByText("הוספת הוצאה"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
