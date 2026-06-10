"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireTenant } from "@/server/auth/session";
import type { ExpenseCategory } from "@prisma/client";
import { FINANCE } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ExpenseFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
  success?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: ExpenseCategory[] = [
  "rent",
  "materials",
  "equipment",
  "marketing",
  "staff",
  "utilities",
  "processing_fees",
  "software",
  "other",
];

function validateExpenseFields(raw: Record<string, string>): {
  ok: false;
  errors: Partial<Record<string, string>>;
} | {
  ok: true;
  value: {
    description: string;
    amount: number;
    category: ExpenseCategory;
    date: Date;
    notes: string | null;
  };
} {
  const errors: Partial<Record<string, string>> = {};

  const description = raw.description?.trim() ?? "";
  if (!description) errors.description = FINANCE.errors.descriptionRequired;

  const rawAmount = raw.amount?.trim() ?? "";
  const amount = parseFloat(rawAmount);
  if (!rawAmount) {
    errors.amount = FINANCE.errors.amountRequired;
  } else if (isNaN(amount) || amount <= 0) {
    errors.amount = FINANCE.errors.amountInvalid;
  }

  const rawDate = raw.date?.trim() ?? "";
  if (!rawDate) errors.date = FINANCE.errors.dateRequired;

  const category = raw.category?.trim() as ExpenseCategory;
  if (!VALID_CATEGORIES.includes(category)) errors.category = FINANCE.errors.categoryRequired;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      description,
      amount,
      category,
      date: new Date(rawDate + "T12:00:00Z"),
      notes: raw.notes?.trim() || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Add expense
// ---------------------------------------------------------------------------

export async function addExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const tenant = await requireTenant();

  const raw: Record<string, string> = {
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    date: String(formData.get("date") ?? ""),
    category: String(formData.get("category") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const result = validateExpenseFields(raw);
  if (!result.ok) return { errors: result.errors };

  const { value } = result;

  try {
    await prisma.expense.create({
      data: {
        businessId: tenant.businessId,
        description: value.description,
        amount: value.amount,
        category: value.category,
        date: value.date,
        notes: value.notes,
      },
    });
  } catch {
    return { formError: FINANCE.errors.generic };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { success: FINANCE.expenseForm.successAdd };
}

// ---------------------------------------------------------------------------
// Update expense
// ---------------------------------------------------------------------------

export async function updateExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const tenant = await requireTenant();

  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) return { formError: FINANCE.errors.generic };

  const raw: Record<string, string> = {
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    date: String(formData.get("date") ?? ""),
    category: String(formData.get("category") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const result = validateExpenseFields(raw);
  if (!result.ok) return { errors: result.errors };

  const { value } = result;

  try {
    const updated = await prisma.expense.updateMany({
      where: { id: expenseId, businessId: tenant.businessId },
      data: {
        description: value.description,
        amount: value.amount,
        category: value.category,
        date: value.date,
        notes: value.notes,
      },
    });
    if (updated.count === 0) return { formError: FINANCE.errors.notFound };
  } catch {
    return { formError: FINANCE.errors.generic };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { success: FINANCE.expenseForm.successEdit };
}

// ---------------------------------------------------------------------------
// Delete expense
// ---------------------------------------------------------------------------

export async function deleteExpenseAction(
  expenseId: string,
): Promise<{ success?: string; error?: string }> {
  const tenant = await requireTenant();

  try {
    const deleted = await prisma.expense.deleteMany({
      where: { id: expenseId, businessId: tenant.businessId },
    });
    if (deleted.count === 0) return { error: FINANCE.errors.notFound };
  } catch {
    return { error: FINANCE.errors.generic };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");
  return { success: FINANCE.expenseForm.successDelete };
}
