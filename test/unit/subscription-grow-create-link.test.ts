import { growPayerName } from "@/lib/subscription/grow";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Grow refuses to create a payment link unless the payer name has two parts of
 * at least two characters each — and a one-word name is completely ordinary for
 * the owners this product serves. Getting this wrong blocks checkout outright.
 */
describe("growPayerName", () => {
  it("passes a real two-part name through untouched", () => {
    expect(growPayerName("מיכל כהן")).toBe("מיכל כהן");
    expect(growPayerName("  שרה   לוי  ")).toBe("שרה לוי");
  });

  it("substitutes a neutral placeholder when Grow would reject the name", () => {
    // The name is only a prefill — Grow invoices whatever the payer types on
    // its own page — so a placeholder is far better than a failed checkout.
    expect(growPayerName("יעל")).toBe("לקוחת Allura");
    expect(growPayerName("א ב")).toBe("לקוחת Allura");
    expect(growPayerName("")).toBe("לקוחת Allura");
    expect(growPayerName(null)).toBe("לקוחת Allura");
  });
});
import { createPaymentLink } from "@/lib/subscription/grow";

/**
 * The request body we POST to Make is a contract: the scenario mapped Grow's
 * required `price` from `sum`, and learned every field's shape from one sample
 * bundle. A field that arrives in a shape Make cannot resolve reaches Grow empty
 * and the scenario dies with "Missing value of required parameter 'price'" —
 * before Grow is called at all, so nothing in Allura's logs explains it.
 */

const INPUT = {
  amountMinor: 19900,
  description: "מנוי Allura — מנוי חודשי",
  fullName: "יעל כהן",
  phone: "0525756333",
  email: "owner@example.com",
  successUrl: "https://www.allura.info/api/subscription/return",
  cancelUrl: "https://www.allura.info/subscribe?canceled=1",
  notifyUrl: "https://www.allura.info/api/subscription/webhook?t=secret",
  nonce: "nonce-1",
  userId: "usr_1",
  plan: "standard",
};

const OK_BODY = JSON.stringify({ url: "https://grow.pay/x", processId: "p1", processToken: "t1" });

function mockFetch(body: string, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("MAKE_GROW_CREATE_LINK_WEBHOOK_URL", "https://hook.eu2.make.com/test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createPaymentLink — the body Make receives", () => {
  it("sends sum as a NUMBER, because Grow's price is a numeric field", async () => {
    const fetchMock = mockFetch(OK_BODY);
    await createPaymentLink(INPUT);

    const body = sentBody(fetchMock);
    expect(typeof body.sum).toBe("number");
    expect(body.sum).toBe(199);
  });

  it("converts agorot to shekels without floating-point drift", async () => {
    const fetchMock = mockFetch(OK_BODY);
    await createPaymentLink({ ...INPUT, amountMinor: 14900 });

    expect(sentBody(fetchMock).sum).toBe(149);
  });

  it("sends cancelUrl — it existed in the sample and was never sent", async () => {
    const fetchMock = mockFetch(OK_BODY);
    await createPaymentLink(INPUT);

    expect(sentBody(fetchMock).cancelUrl).toBe(INPUT.cancelUrl);
  });

  it("sends the payer's phone through untouched", async () => {
    const fetchMock = mockFetch(OK_BODY);
    await createPaymentLink(INPUT);

    expect(sentBody(fetchMock).phone).toBe("0525756333");
  });

  it("carries Make's own error text into the thrown error", async () => {
    mockFetch("Missing value of required parameter 'price'.", false, 400);

    await expect(createPaymentLink(INPUT)).rejects.toThrow(/price/);
  });

  it("names an inactive scenario rather than reporting a generic parse failure", async () => {
    mockFetch("Accepted");

    await expect(createPaymentLink(INPUT)).rejects.toThrow(/Accepted/);
  });

  it("still refuses a 200 that carries no payment link", async () => {
    mockFetch(JSON.stringify({ url: "https://grow.pay/x" }));

    await expect(createPaymentLink(INPUT)).rejects.toThrow(/missing url\/processId\/processToken/);
  });
});
