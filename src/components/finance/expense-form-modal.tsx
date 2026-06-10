"use client";

import { useActionState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { FINANCE } from "@/lib/constants/he";
import { addExpenseAction, updateExpenseAction } from "@/server/finance/actions";
import type { ExpenseFormState } from "@/server/finance/actions";
import type { ExpenseItem } from "@/server/finance/queries";

interface Props {
  open: boolean;
  expense?: ExpenseItem | null;
  onClose: () => void;
}

const INITIAL_STATE: ExpenseFormState = {};

const CATEGORY_OPTIONS = Object.entries(FINANCE.categories) as [string, string][];

export function ExpenseFormModal({ open, expense, onClose }: Props) {
  const isEdit = !!expense;
  const action = isEdit ? updateExpenseAction : addExpenseAction;

  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      onClose();
      formRef.current?.reset();
    }
  }, [state.success, onClose]);

  // Reset form errors when modal reopens
  useEffect(() => {
    if (open) {
      formRef.current?.reset();
    }
  }, [open, expense?.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        dir="rtl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            {isEdit ? FINANCE.expenseForm.editTitle : FINANCE.expenseForm.addTitle}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
            aria-label="סגירה"
          >
            <X className="h-4 w-4" style={{ color: "var(--muted)" }} />
          </button>
        </div>

        {state.formError && (
          <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {state.formError}
          </p>
        )}

        <form ref={formRef} action={formAction} className="space-y-4">
          {isEdit && (
            <input type="hidden" name="expenseId" value={expense.id} />
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
              {FINANCE.expenseForm.descriptionLabel}
            </label>
            <input
              name="description"
              type="text"
              defaultValue={expense?.description ?? ""}
              placeholder={FINANCE.expenseForm.descriptionPlaceholder}
              className="w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                background: "var(--surface)",
                borderColor: state.errors?.description ? "#ef4444" : "var(--border)",
                color: "var(--foreground)",
              }}
            />
            {state.errors?.description && (
              <p className="text-xs" style={{ color: "#ef4444" }}>{state.errors.description}</p>
            )}
          </div>

          {/* Amount + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
                {FINANCE.expenseForm.amountLabel}
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={expense ? String(expense.amount) : ""}
                placeholder={FINANCE.expenseForm.amountPlaceholder}
                className="w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                style={{
                  background: "var(--surface)",
                  borderColor: state.errors?.amount ? "#ef4444" : "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              {state.errors?.amount && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{state.errors.amount}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
                {FINANCE.expenseForm.dateLabel}
              </label>
              <input
                name="date"
                type="date"
                defaultValue={expense?.date ?? new Date().toISOString().slice(0, 10)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                style={{
                  background: "var(--surface)",
                  borderColor: state.errors?.date ? "#ef4444" : "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              {state.errors?.date && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{state.errors.date}</p>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
              {FINANCE.expenseForm.categoryLabel}
            </label>
            <select
              name="category"
              defaultValue={expense?.category ?? ""}
              className="w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                background: "var(--surface)",
                borderColor: state.errors?.category ? "#ef4444" : "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <option value="" disabled>בחרי קטגוריה…</option>
              {CATEGORY_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {state.errors?.category && (
              <p className="text-xs" style={{ color: "#ef4444" }}>{state.errors.category}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
              {FINANCE.expenseForm.notesLabel}
            </label>
            <textarea
              name="notes"
              defaultValue={expense?.notes ?? ""}
              placeholder={FINANCE.expenseForm.notesPlaceholder}
              rows={2}
              className="w-full rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none resize-none"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
            >
              {isPending ? FINANCE.expenseForm.saving : FINANCE.expenseForm.saveButton}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--foreground-soft)",
              }}
            >
              {FINANCE.expenseForm.cancelButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
