import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin subscription action (server/admin/actions.ts).
 *
 * SECURITY/VALIDATION:
 *   - requirePlatformAdmin runs before any write.
 *   - Monthly price and discount value are validated; invalid input returns a
 *     safe Hebrew error and performs NO upsert.
 *   - The upsert is scoped by businessId; suspended/cancelled timestamps are set
 *     only on those status transitions.
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

const requirePlatformAdmin = vi.fn(async () => undefined);
vi.mock("@/server/admin/auth", () => ({
  requirePlatformAdmin: (...a: unknown[]) => requirePlatformAdmin(...(a as [])),
}));

import {
  updateBusinessSubscription,
  type UpdateSubscriptionInput,
} from "@/server/admin/actions";

function baseInput(overrides: Partial<UpdateSubscriptionInput> = {}): UpdateSubscriptionInput {
  return {
    plan: "basic",
    status: "active",
    monthlyPrice: "99",
    discountType: "none",
    discountValue: "",
    discountNote: "",
    trialStartedAt: "",
    trialEndsAt: "",
    adminNotes: "",
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requirePlatformAdmin.mockReset().mockResolvedValue(undefined);
  prisma.businessSubscription.upsert.mockResolvedValue({});
});

describe("updateBusinessSubscription — auth", () => {
  it("requires a platform admin before any write", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      updateBusinessSubscription(BUSINESS_A, baseInput()),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.businessSubscription.upsert).not.toHaveBeenCalled();
  });
});

describe("updateBusinessSubscription — validation", () => {
  it("rejects a non-numeric monthly price without writing", async () => {
    const res = await updateBusinessSubscription(BUSINESS_A, baseInput({ monthlyPrice: "abc" }));
    expect(res).toEqual({ success: false, error: "מחיר חודשי לא תקין" });
    expect(prisma.businessSubscription.upsert).not.toHaveBeenCalled();
  });

  it("rejects a negative monthly price", async () => {
    const res = await updateBusinessSubscription(BUSINESS_A, baseInput({ monthlyPrice: "-5" }));
    expect(res.success).toBe(false);
    expect(prisma.businessSubscription.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid discount value when a discount type is set", async () => {
    const res = await updateBusinessSubscription(
      BUSINESS_A,
      baseInput({ discountType: "percentage", discountValue: "notnum" }),
    );
    expect(res).toEqual({ success: false, error: "ערך הנחה לא תקין" });
    expect(prisma.businessSubscription.upsert).not.toHaveBeenCalled();
  });

  it("allows an invalid discount value when discountType is none (value parsed but ignored by guard)", async () => {
    // discountType === "none" skips the NaN guard, so this succeeds.
    const res = await updateBusinessSubscription(
      BUSINESS_A,
      baseInput({ discountType: "none", discountValue: "notnum" }),
    );
    expect(res.success).toBe(true);
    const payload = (prisma.businessSubscription.upsert.mock.calls[0][0] as {
      update: { discountValue: number };
    }).update;
    expect(Number.isNaN(payload.discountValue)).toBe(true);
  });
});

describe("updateBusinessSubscription — write", () => {
  it("upserts scoped by businessId with parsed numeric/date fields and nulls for empties", async () => {
    const res = await updateBusinessSubscription(
      BUSINESS_A,
      baseInput({
        plan: "pro",
        status: "active",
        monthlyPrice: "120.50",
        discountType: "percentage",
        discountValue: "10",
        discountNote: "חבר",
        trialStartedAt: "2026-01-01",
        trialEndsAt: "2026-02-01",
        adminNotes: "הערה",
      }),
    );
    expect(res).toEqual({ success: true });

    const call = prisma.businessSubscription.upsert.mock.calls[0][0] as {
      where: { businessId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.where).toEqual({ businessId: BUSINESS_A });
    expect(call.create.businessId).toBe(BUSINESS_A);
    expect(call.update.plan).toBe("pro");
    expect(call.update.monthlyPrice).toBe(120.5);
    expect(call.update.discountValue).toBe(10);
    expect(call.update.discountNote).toBe("חבר");
    expect(call.update.adminNotes).toBe("הערה");
    expect(call.update.trialStartedAt).toBeInstanceOf(Date);
    expect(call.update.trialEndsAt).toBeInstanceOf(Date);
    // active status => no suspended/cancelled timestamps
    expect(call.update.suspendedAt).toBeNull();
    expect(call.update.cancelledAt).toBeNull();
  });

  it("nulls optional text/date fields and discountValue when blank", async () => {
    await updateBusinessSubscription(
      BUSINESS_A,
      baseInput({ discountValue: "", discountNote: "", adminNotes: "", trialStartedAt: "", trialEndsAt: "" }),
    );
    const payload = (prisma.businessSubscription.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    }).update;
    expect(payload.discountValue).toBeNull();
    expect(payload.discountNote).toBeNull();
    expect(payload.adminNotes).toBeNull();
    expect(payload.trialStartedAt).toBeNull();
    expect(payload.trialEndsAt).toBeNull();
  });

  it("sets suspendedAt when status is suspended", async () => {
    await updateBusinessSubscription(BUSINESS_A, baseInput({ status: "suspended" }));
    const payload = (prisma.businessSubscription.upsert.mock.calls[0][0] as {
      update: { suspendedAt: Date | null; cancelledAt: Date | null };
    }).update;
    expect(payload.suspendedAt).toBeInstanceOf(Date);
    expect(payload.cancelledAt).toBeNull();
  });

  it("sets cancelledAt when status is cancelled", async () => {
    await updateBusinessSubscription(BUSINESS_A, baseInput({ status: "cancelled" }));
    const payload = (prisma.businessSubscription.upsert.mock.calls[0][0] as {
      update: { suspendedAt: Date | null; cancelledAt: Date | null };
    }).update;
    expect(payload.cancelledAt).toBeInstanceOf(Date);
    expect(payload.suspendedAt).toBeNull();
  });
});
