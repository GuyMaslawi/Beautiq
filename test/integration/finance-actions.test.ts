import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";
import { FINANCE } from "@/lib/constants/he";

/**
 * Finance expense actions. Multi-tenant scoping is the headline assertion:
 * every create/update/delete carries businessId = the authenticated tenant, and
 * a cross-tenant id can never mutate another business's rows (updateMany/
 * deleteMany are scoped, so count===0 → notFound).
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn(async () => ({ businessId: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireTenant: (...args: unknown[]) => (requireTenant as (...a: unknown[]) => unknown)(...args),
}));

import {
  addExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "@/server/finance/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const validExpense = {
  description: "חומרים",
  amount: "120.50",
  date: "2026-06-10",
  category: "materials",
  notes: "",
};

describe("addExpenseAction", () => {
  it("creates the expense scoped to the authenticated business", async () => {
    prisma.expense.create.mockResolvedValue({ id: "exp_1" });
    const res = await addExpenseAction({}, fd(validExpense));
    expect(res.success).toBeTruthy();
    expect(prisma.expense.create).toHaveBeenCalledTimes(1);
    const arg = prisma.expense.create.mock.calls[0][0] as {
      data: { businessId: string; amount: number; category: string };
    };
    expect(arg.data.businessId).toBe(BUSINESS_A);
    expect(arg.data.amount).toBe(120.5);
    expect(arg.data.category).toBe("materials");
  });

  it("never trusts a businessId supplied via the form", async () => {
    prisma.expense.create.mockResolvedValue({ id: "exp_1" });
    await addExpenseAction({}, fd({ ...validExpense, businessId: BUSINESS_B }));
    const arg = prisma.expense.create.mock.calls[0][0] as {
      data: { businessId: string };
    };
    expect(arg.data.businessId).toBe(BUSINESS_A);
  });

  it("requires a description", async () => {
    const res = await addExpenseAction({}, fd({ ...validExpense, description: "" }));
    expect(res.errors?.description).toBe(FINANCE.errors.descriptionRequired);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive / non-numeric amount", async () => {
    const zero = await addExpenseAction({}, fd({ ...validExpense, amount: "0" }));
    expect(zero.errors?.amount).toBe(FINANCE.errors.amountInvalid);

    const nan = await addExpenseAction({}, fd({ ...validExpense, amount: "abc" }));
    expect(nan.errors?.amount).toBe(FINANCE.errors.amountInvalid);

    const empty = await addExpenseAction({}, fd({ ...validExpense, amount: "" }));
    expect(empty.errors?.amount).toBe(FINANCE.errors.amountRequired);

    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("requires a date", async () => {
    const res = await addExpenseAction({}, fd({ ...validExpense, date: "" }));
    expect(res.errors?.date).toBe(FINANCE.errors.dateRequired);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown category", async () => {
    const res = await addExpenseAction(
      {},
      fd({ ...validExpense, category: "not_a_category" }),
    );
    expect(res.errors?.category).toBe(FINANCE.errors.categoryRequired);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it("returns a safe generic error (no secret) when the DB write throws", async () => {
    prisma.expense.create.mockRejectedValue(new Error("secret db connection"));
    const res = await addExpenseAction({}, fd(validExpense));
    expect(res.formError).toBe(FINANCE.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});

describe("updateExpenseAction", () => {
  it("scopes the updateMany by businessId AND id (cross-tenant rows untouched)", async () => {
    prisma.expense.updateMany.mockResolvedValue({ count: 1 });
    const res = await updateExpenseAction(
      {},
      fd({ ...validExpense, expenseId: "exp_1" }),
    );
    expect(res.success).toBeTruthy();
    expect(prisma.expense.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exp_1", businessId: BUSINESS_A },
      }),
    );
  });

  it("returns notFound (no error thrown) when the scoped update matches nothing", async () => {
    // A cross-tenant id: the scoped updateMany matches 0 rows.
    prisma.expense.updateMany.mockResolvedValue({ count: 0 });
    const res = await updateExpenseAction(
      {},
      fd({ ...validExpense, expenseId: "exp_other_biz" }),
    );
    expect(res.formError).toBe(FINANCE.errors.notFound);
  });

  it("rejects without an expenseId", async () => {
    const res = await updateExpenseAction({}, fd(validExpense));
    expect(res.formError).toBe(FINANCE.errors.generic);
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
  });

  it("validates fields before writing", async () => {
    const res = await updateExpenseAction(
      {},
      fd({ ...validExpense, amount: "-5", expenseId: "exp_1" }),
    );
    expect(res.errors?.amount).toBeTruthy();
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteExpenseAction", () => {
  it("scopes the deleteMany by businessId AND id", async () => {
    prisma.expense.deleteMany.mockResolvedValue({ count: 1 });
    const res = await deleteExpenseAction("exp_1");
    expect(res.success).toBeTruthy();
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: "exp_1", businessId: BUSINESS_A },
    });
  });

  it("returns notFound when deleting a cross-tenant id (0 rows matched)", async () => {
    prisma.expense.deleteMany.mockResolvedValue({ count: 0 });
    const res = await deleteExpenseAction("exp_other_biz");
    expect(res.error).toBe(FINANCE.errors.notFound);
  });

  it("returns a safe error when the delete throws", async () => {
    prisma.expense.deleteMany.mockRejectedValue(new Error("secret boom"));
    const res = await deleteExpenseAction("exp_1");
    expect(res.error).toBe(FINANCE.errors.generic);
    expect(res.error).not.toContain("secret");
  });
});
