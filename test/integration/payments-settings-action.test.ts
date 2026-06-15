import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";
import { PAYMENTS } from "@/lib/constants/he";

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
  requireTenant: (...a: unknown[]) => (requireTenant as (...x: unknown[]) => unknown)(...a),
}));

import { updatePaymentSettingsAction } from "@/server/payments/actions";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
});

describe("updatePaymentSettingsAction", () => {
  it("upserts settings scoped to the tenant businessId", async () => {
    prisma.businessPaymentSettings.upsert.mockResolvedValue({});
    const res = await updatePaymentSettingsAction(
      {},
      fd({
        enabled: "true",
        provider: "mock",
        requirement: "full_payment",
        allowPayAtBusiness: "true",
      }),
    );
    expect(res.success).toBe(PAYMENTS.settings.success);
    const arg = prisma.businessPaymentSettings.upsert.mock.calls[0][0] as {
      where: { businessId: string };
      create: Record<string, unknown>;
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.create.businessId).toBe(BUSINESS_A);
    expect(arg.create.requirement).toBe("full_payment");
    // No deposit fields are ever persisted.
    expect("depositAmountMinor" in arg.create).toBe(false);
    expect("depositType" in arg.create).toBe(false);
    expect("depositPercentage" in arg.create).toBe(false);
  });

  it("never targets a businessId injected via the form", async () => {
    prisma.businessPaymentSettings.upsert.mockResolvedValue({});
    await updatePaymentSettingsAction(
      {},
      fd({ enabled: "true", provider: "mock", requirement: "none", businessId: BUSINESS_B }),
    );
    const arg = prisma.businessPaymentSettings.upsert.mock.calls[0][0] as {
      where: { businessId: string };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
  });

  it("coerces a legacy 'deposit' requirement down to 'none' before writing", async () => {
    prisma.businessPaymentSettings.upsert.mockResolvedValue({});
    await updatePaymentSettingsAction(
      {},
      fd({ enabled: "true", provider: "mock", requirement: "deposit" }),
    );
    const arg = prisma.businessPaymentSettings.upsert.mock.calls[0][0] as {
      create: { requirement: string };
    };
    expect(arg.create.requirement).toBe("none");
  });

  it("returns a safe generic error when the write throws", async () => {
    prisma.businessPaymentSettings.upsert.mockRejectedValue(
      new Error("secret db boom"),
    );
    const res = await updatePaymentSettingsAction(
      {},
      fd({ enabled: "true", provider: "mock", requirement: "none" }),
    );
    expect(res.formError).toBe(PAYMENTS.errors.generic);
    expect(res.formError).not.toContain("secret");
  });
});
