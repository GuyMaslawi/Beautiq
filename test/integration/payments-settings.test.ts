import { describe, it, expect, vi, beforeEach } from "vitest";
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

import {
  getPaymentSettings,
  getPublicPaymentPolicy,
  getBookingPaymentForBooking,
} from "@/server/payments/settings";

beforeEach(() => resetPrismaMock(prisma));

describe("getPaymentSettings", () => {
  it("returns sensible defaults when no row exists", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue(null);
    const res = await getPaymentSettings(BUSINESS_A);
    expect(res).toEqual({
      enabled: false,
      provider: "mock",
      requirement: "none",
      allowPayAtBusiness: true,
      instructions: "",
    });
    expect(prisma.businessPaymentSettings.findUnique).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A },
    });
  });

  it("maps a stored row, coalescing null instructions to empty string", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      provider: "payplus",
      requirement: "full_payment",
      allowPayAtBusiness: false,
      instructions: null,
    });
    const res = await getPaymentSettings(BUSINESS_A);
    expect(res).toEqual({
      enabled: true,
      provider: "payplus",
      requirement: "full_payment",
      allowPayAtBusiness: false,
      instructions: "",
    });
  });

  it("preserves a real instructions string", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      provider: "mock",
      requirement: "full_payment",
      allowPayAtBusiness: true,
      instructions: "שלמי מראש",
    });
    const res = await getPaymentSettings(BUSINESS_A);
    expect(res.instructions).toBe("שלמי מראש");
  });
});

describe("getPublicPaymentPolicy", () => {
  it("returns null when no settings row exists", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue(null);
    expect(await getPublicPaymentPolicy(BUSINESS_A)).toBeNull();
  });

  it("returns null when payments are disabled", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: false,
      requirement: "full_payment",
      allowPayAtBusiness: true,
      instructions: null,
      provider: "mock",
    });
    expect(await getPublicPaymentPolicy(BUSINESS_A)).toBeNull();
  });

  it("returns null when no payment is required", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      requirement: "none",
      allowPayAtBusiness: true,
      instructions: null,
      provider: "mock",
    });
    expect(await getPublicPaymentPolicy(BUSINESS_A)).toBeNull();
  });

  it("returns a credential-free policy when payment is required", async () => {
    prisma.businessPaymentSettings.findUnique.mockResolvedValue({
      enabled: true,
      requirement: "full_payment",
      allowPayAtBusiness: false,
      instructions: "note",
      provider: "mock",
    });
    const policy = await getPublicPaymentPolicy(BUSINESS_A);
    expect(policy).toEqual({
      requirement: "full_payment",
      allowPayAtBusiness: false,
      instructions: "note",
      provider: "mock",
    });
    // never selects credential fields
    const selectArg = prisma.businessPaymentSettings.findUnique.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(selectArg.select).not.toHaveProperty("credentialsEncrypted");
  });
});

describe("getBookingPaymentForBooking", () => {
  it("scopes the lookup by both businessId and bookingId", async () => {
    prisma.bookingPayment.findFirst.mockResolvedValue({
      status: "paid",
      amountMinor: 5000,
      paymentUrl: null,
    });
    const res = await getBookingPaymentForBooking(BUSINESS_A, "bkg_1");
    expect(res).toEqual({ status: "paid", amountMinor: 5000, paymentUrl: null });
    expect(prisma.bookingPayment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A, bookingId: "bkg_1" },
      }),
    );
  });

  it("returns null when there is no payment row", async () => {
    prisma.bookingPayment.findFirst.mockResolvedValue(null);
    expect(await getBookingPaymentForBooking(BUSINESS_A, "bkg_x")).toBeNull();
  });
});
