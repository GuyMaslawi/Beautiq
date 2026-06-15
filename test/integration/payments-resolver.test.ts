import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import { resolvePaymentProviderForBusiness } from "@/server/payments/resolver";
import { getPublicPaymentPolicy } from "@/server/payments/settings";

beforeEach(() => resetPrismaMock(prisma));
afterEach(() => {
  delete process.env.PAYMENTS_ENABLED;
  delete process.env.PAYMENT_PROVIDER;
});

describe("resolvePaymentProviderForBusiness — never real in tests", () => {
  it("uses the safe mock provider when configured provider is mock", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "mock" });
    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.isReal).toBe(false);
    expect(res.provider.isReal).toBe(false);
    expect(res.status).toBe("mock");
  });

  it("falls back to mock when a real provider is selected but env gating is off", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "payplus" });
    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.isReal).toBe(false);
    expect(res.status).toBe("mock");
  });

  it("fails closed (disabled provider) when env on but no active connection", async () => {
    process.env.PAYMENTS_ENABLED = "true";
    process.env.PAYMENT_PROVIDER = "payplus";
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "payplus" });
    prisma.paymentProviderConnection.findUnique.mockResolvedValue(null);

    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.isReal).toBe(false);
    expect(res.status).toBe("not_connected");
    await expect(
      res.provider.createPaymentLink({
        businessId: BUSINESS_A,
        bookingPaymentId: "bp",
        amountMinor: 5000,
        currency: "ILS",
        description: "x",
        customerName: "x",
        customerPhone: "x",
        returnSuccessUrl: "x",
        returnFailureUrl: "x",
        webhookUrl: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("getPublicPaymentPolicy — disabled keeps the old flow", () => {
  it("returns null when payments are disabled", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: false,
      requirement: "full_payment",
      allowPayAtBusiness: true,
    });
    expect(await getPublicPaymentPolicy(BUSINESS_A)).toBeNull();
  });

  it("returns null when no payment is required", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      requirement: "none",
      allowPayAtBusiness: true,
    });
    expect(await getPublicPaymentPolicy(BUSINESS_A)).toBeNull();
  });

  it("returns a policy (no credentials) when full payment is required", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      requirement: "full_payment",
      allowPayAtBusiness: true,
      instructions: "note",
      provider: "mock",
    });
    const policy = await getPublicPaymentPolicy(BUSINESS_A);
    expect(policy).not.toBeNull();
    expect(policy?.requirement).toBe("full_payment");
    // No deposit fields are ever surfaced.
    expect(JSON.stringify(policy)).not.toContain("deposit");
    // Public policy must never carry credentials.
    expect(JSON.stringify(policy)).not.toContain("credential");
  });
});
