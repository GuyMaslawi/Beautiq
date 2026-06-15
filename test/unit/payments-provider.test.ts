import { describe, it, expect } from "vitest";
import {
  mockProvider,
  createDisabledProvider,
  isRealPaymentsConfigured,
} from "@/lib/payments/provider";

const linkInput = {
  businessId: "biz_1",
  bookingPaymentId: "bp_1",
  amountMinor: 5000,
  currency: "ILS",
  description: "מניקור · סטודיו",
  customerName: "דנה",
  customerPhone: "0501234567",
  returnSuccessUrl: "http://localhost/ok",
  returnFailureUrl: "http://localhost/fail",
  webhookUrl: "http://localhost/api/payments/mock/webhook",
};

describe("mock provider", () => {
  it("is not a real (money-moving) provider", () => {
    expect(mockProvider.isReal).toBe(false);
  });

  it("creates a hosted payment link pointing at the in-app mock page", async () => {
    const res = await mockProvider.createPaymentLink(linkInput);
    expect(res.paymentUrl).toContain("/pay/mock/bp_1");
    expect(res.providerTransactionId).toMatch(/^mock_/);
    expect(res.paymentUrl).toContain(res.providerTransactionId);
  });

  it("accepts unsigned webhooks when no secret is configured", () => {
    const body = JSON.stringify({ txn: "mock_x", status: "paid" });
    expect(mockProvider.verifyWebhook({ rawBody: body, headers: {} })).toBe(true);
  });

  it("requires a matching signature when a secret is configured", () => {
    const body = JSON.stringify({ txn: "mock_x", status: "paid" });
    expect(
      mockProvider.verifyWebhook({ rawBody: body, headers: {}, secret: "s" }),
    ).toBe(false);
  });

  it("parses a paid webhook", () => {
    const body = JSON.stringify({ txn: "mock_x", status: "paid", amountMinor: 5000 });
    const ev = mockProvider.parseWebhook({ rawBody: body, headers: {} });
    expect(ev?.providerTransactionId).toBe("mock_x");
    expect(ev?.status).toBe("paid");
    expect(ev?.paidAt).toBeInstanceOf(Date);
  });

  it("normalizes unknown statuses to failed and ignores junk bodies", () => {
    const ev = mockProvider.parseWebhook({
      rawBody: JSON.stringify({ txn: "mock_x", status: "weird" }),
      headers: {},
    });
    expect(ev?.status).toBe("failed");
    expect(mockProvider.parseWebhook({ rawBody: "not json", headers: {} })).toBeNull();
  });
});

describe("disabled provider fails closed", () => {
  const p = createDisabledProvider("payplus", "not implemented");

  it("throws when asked to create a link", async () => {
    await expect(p.createPaymentLink(linkInput)).rejects.toThrow();
  });

  it("never verifies a webhook", () => {
    expect(p.verifyWebhook({ rawBody: "{}", headers: {} })).toBe(false);
  });
});

describe("isRealPaymentsConfigured (env gating)", () => {
  it("is false by default (tests never move real money)", () => {
    expect(isRealPaymentsConfigured()).toBe(false);
  });

  it("is false unless PAYMENTS_ENABLED and a non-mock provider are set", () => {
    process.env.PAYMENTS_ENABLED = "true";
    expect(isRealPaymentsConfigured()).toBe(false);
    process.env.PAYMENT_PROVIDER = "mock";
    expect(isRealPaymentsConfigured()).toBe(false);
    process.env.PAYMENT_PROVIDER = "payplus";
    expect(isRealPaymentsConfigured()).toBe(true);
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.PAYMENT_PROVIDER;
  });
});
