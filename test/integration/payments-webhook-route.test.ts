import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const applyPaymentWebhookEvent = vi.fn(async () => ({ applied: true }));
vi.mock("@/server/payments/booking-payment", () => ({
  applyPaymentWebhookEvent: (...a: unknown[]) =>
    (applyPaymentWebhookEvent as (...x: unknown[]) => unknown)(...a),
}));

import { POST } from "@/app/api/payments/[provider]/webhook/route";

function req(provider: string, body: string, headers: Record<string, string> = {}) {
  const r = new NextRequest(`http://localhost/api/payments/${provider}/webhook`, {
    method: "POST",
    body,
    headers,
  });
  return POST(r, { params: Promise.resolve({ provider }) });
}

beforeEach(() => applyPaymentWebhookEvent.mockClear());

describe("payments webhook route", () => {
  it("acknowledges (200) an unsupported provider without applying anything", async () => {
    const res = await req("payplus", JSON.stringify({ txn: "x", status: "paid" }));
    expect(res.status).toBe(200);
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });

  it("applies a valid mock paid webhook", async () => {
    const res = await req("mock", JSON.stringify({ txn: "mock_x", status: "paid" }));
    expect(res.status).toBe(200);
    expect(applyPaymentWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ providerTransactionId: "mock_x", status: "paid" }),
    );
  });

  it("rejects an unparseable mock body with 400", async () => {
    const res = await req("mock", "not-json");
    expect(res.status).toBe(400);
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });

  it("does not trust a body without a transaction id", async () => {
    const res = await req("mock", JSON.stringify({ status: "paid" }));
    expect(res.status).toBe(400);
    expect(applyPaymentWebhookEvent).not.toHaveBeenCalled();
  });
});
