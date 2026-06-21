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

// Control credential decryption to drive the deeper resolver branches without
// needing a real encryption key.
const tryDecryptCredentials = vi.fn();
vi.mock("@/lib/payments/crypto", () => ({
  tryDecryptCredentials: (...a: unknown[]) => tryDecryptCredentials(...a),
}));

import { resolvePaymentProviderForBusiness } from "@/server/payments/resolver";

beforeEach(() => {
  resetPrismaMock(prisma);
  tryDecryptCredentials.mockReset();
});
afterEach(() => {
  delete process.env.PAYMENTS_ENABLED;
  delete process.env.PAYMENT_PROVIDER;
});

function enableRealPayments(provider = "payplus") {
  process.env.PAYMENTS_ENABLED = "true";
  process.env.PAYMENT_PROVIDER = provider;
}

describe("resolvePaymentProviderForBusiness — disabled configured provider", () => {
  it("returns the mock provider when the configured provider is 'disabled'", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "disabled" });
    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.status).toBe("mock");
    expect(res.isReal).toBe(false);
    expect(res.configuredProvider).toBe("disabled");
  });

  it("defaults to mock when no settings row exists", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue(null);
    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.configuredProvider).toBe("mock");
    expect(res.status).toBe("mock");
  });
});

describe("resolvePaymentProviderForBusiness — env on, active connection", () => {
  it("fails to 'error' (disabled provider) when credentials cannot be decrypted", async () => {
    enableRealPayments();
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "payplus" });
    prisma.paymentProviderConnection.findUnique.mockResolvedValue({
      status: "active",
      credentialsEncrypted: "garbage",
    });
    tryDecryptCredentials.mockReturnValue(null);

    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.status).toBe("error");
    expect(res.isReal).toBe(false);
    expect(res.provider.isReal).toBe(false);
    expect(res.statusDetail).toBeTruthy();
  });

  it("fails closed to 'error' (adapter not implemented) even with valid credentials", async () => {
    enableRealPayments();
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "payplus" });
    prisma.paymentProviderConnection.findUnique.mockResolvedValue({
      status: "active",
      credentialsEncrypted: "ok",
    });
    tryDecryptCredentials.mockReturnValue({ apiKey: "k" });

    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.status).toBe("error");
    expect(res.isReal).toBe(false);
    // The disabled provider must throw rather than silently move money.
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

  it("returns 'not_connected' when the connection is inactive", async () => {
    enableRealPayments();
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({ provider: "payplus" });
    prisma.paymentProviderConnection.findUnique.mockResolvedValue({ status: "pending" });

    const res = await resolvePaymentProviderForBusiness(BUSINESS_A);
    expect(res.status).toBe("not_connected");
    expect(tryDecryptCredentials).not.toHaveBeenCalled();
  });
});
