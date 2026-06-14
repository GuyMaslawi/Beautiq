import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";
import { SETTINGS } from "@/lib/constants/he";

/**
 * Settings actions — these write to PUBLIC business data, so scoping by
 * businessId and rejecting invalid input (broken public page) are both
 * critical.
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
  updateBusinessDetailsAction,
  updateBusinessCategoriesAction,
  updateCancellationPolicyAction,
} from "@/server/settings/actions";

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

describe("updateBusinessDetailsAction", () => {
  it("updates the business scoped by the tenant businessId", async () => {
    prisma.business.update.mockResolvedValue({});
    const res = await updateBusinessDetailsAction(
      {},
      fd({ name: "סטודיו חדש", phone: "0501234567", city: "חיפה" }),
    );
    expect(res.success).toBe(SETTINGS.businessDetails.success);
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BUSINESS_A },
        data: expect.objectContaining({ name: "סטודיו חדש", phone: "0501234567" }),
      }),
    );
  });

  it("never targets a businessId injected via the form", async () => {
    prisma.business.update.mockResolvedValue({});
    await updateBusinessDetailsAction(
      {},
      fd({ name: "עסק", businessId: BUSINESS_B }),
    );
    const arg = prisma.business.update.mock.calls[0][0] as {
      where: { id: string };
    };
    expect(arg.where.id).toBe(BUSINESS_A);
  });

  it("rejects a missing name before writing (would break the public page)", async () => {
    const res = await updateBusinessDetailsAction({}, fd({ name: "" }));
    expect(res.errors?.name).toBe(SETTINGS.errors.nameRequired);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone before writing", async () => {
    const res = await updateBusinessDetailsAction(
      {},
      fd({ name: "עסק", phone: "123" }),
    );
    expect(res.errors?.phone).toBe(SETTINGS.errors.phoneInvalid);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when the update throws", async () => {
    prisma.business.update.mockRejectedValue(new Error("secret db error"));
    const res = await updateBusinessDetailsAction({}, fd({ name: "עסק" }));
    expect(res.formError).toBe(SETTINGS.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});

describe("updateBusinessCategoriesAction", () => {
  it("replaces categories scoped by businessId, ignoring unknown ids", async () => {
    // deleteMany + findMany (validation) + createMany happen inside $transaction.
    prisma.businessCategoryOnBusiness.deleteMany.mockResolvedValue({ count: 1 });
    prisma.businessCategory.findMany.mockResolvedValue([{ id: "cat_1" }]);
    prisma.businessCategoryOnBusiness.createMany.mockResolvedValue({ count: 1 });

    const res = await updateBusinessCategoriesAction(
      {},
      fd({ categoryIds: ["cat_1", "cat_unknown"] }),
    );
    expect(res.success).toBe(SETTINGS.categories.success);

    expect(prisma.businessCategoryOnBusiness.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
    // Only the valid id is linked, and it is linked to the tenant business.
    const createArg = prisma.businessCategoryOnBusiness.createMany.mock
      .calls[0][0] as { data: { businessId: string; categoryId: string }[] };
    expect(createArg.data).toEqual([
      { businessId: BUSINESS_A, categoryId: "cat_1" },
    ]);
  });

  it("clears all categories when none are selected (no createMany)", async () => {
    prisma.businessCategoryOnBusiness.deleteMany.mockResolvedValue({ count: 2 });
    const res = await updateBusinessCategoriesAction({}, fd({}));
    expect(res.success).toBe(SETTINGS.categories.success);
    expect(prisma.businessCategoryOnBusiness.deleteMany).toHaveBeenCalled();
    expect(prisma.businessCategoryOnBusiness.createMany).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when the transaction throws", async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error("secret boom"));
    const res = await updateBusinessCategoriesAction(
      {},
      fd({ categoryIds: ["cat_1"] }),
    );
    expect(res.formError).toBe(SETTINGS.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});

describe("updateCancellationPolicyAction", () => {
  it("upserts the policy scoped by businessId", async () => {
    prisma.cancellationPolicy.upsert.mockResolvedValue({});
    const res = await updateCancellationPolicyAction(
      {},
      fd({ enabled: "true", minNoticeHours: "24", lateCancellationFeeType: "none" }),
    );
    expect(res.success).toBe(SETTINGS.cancellationPolicy.success);
    const arg = prisma.cancellationPolicy.upsert.mock.calls[0][0] as {
      where: { businessId: string };
      create: { businessId: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.create.businessId).toBe(BUSINESS_A);
  });

  it("rejects an invalid minimum notice before writing", async () => {
    const res = await updateCancellationPolicyAction(
      {},
      fd({ minNoticeHours: "-5" }),
    );
    expect(res.errors?.minNoticeHours).toBeTruthy();
    expect(prisma.cancellationPolicy.upsert).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when the upsert throws", async () => {
    prisma.cancellationPolicy.upsert.mockRejectedValue(new Error("secret db"));
    const res = await updateCancellationPolicyAction({}, fd({}));
    expect(res.formError).toBe(SETTINGS.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});
