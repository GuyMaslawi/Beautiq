import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * The Grow subscription webhook is the payment authorization boundary: it is the
 * only thing that sets AccountSubscription.status=active and mirrors User.plan,
 * which is the flag the app paywall reads.
 *
 * Grow signs nothing, so the sender is authenticated with a secret embedded in
 * the notifyUrl we hand it at checkout (`?t=<secret>`). Previously only the FIRST
 * charge was authenticated (via processToken); every automatic monthly run was
 * matched by directDebitId alone with no authentication at all — so anyone who
 * learned or guessed a directDebitId could grant themselves a paid plan forever,
 * or force a paying customer's subscription to lapse.
 */
vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const confirmSubscriptionPayment = vi.fn();
const markRenewalFailed = vi.fn();
vi.mock("@/server/subscription/service", () => ({
  confirmSubscriptionPayment: (...a: unknown[]) => confirmSubscriptionPayment(...a),
  markRenewalFailed: (...a: unknown[]) => markRenewalFailed(...a),
}));

const approveTransaction = vi.fn(async () => true);
vi.mock("@/lib/subscription/grow", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/subscription/grow")
  >("@/lib/subscription/grow");
  return { ...actual, approveTransaction: () => approveTransaction() };
});

import { POST } from "@/app/api/subscription/webhook/route";

const SECRET = "webhook-secret-value";

/** An active subscription matched by its Grow standing-order id. */
function activeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    userId: "usr_1",
    plan: "platinum",
    status: "active",
    priceMinor: 24900,
    processId: null,
    processToken: null,
    checkoutNonce: null,
    directDebitId: "DD-123",
    providerTransactionId: "txn-old",
    currentPeriodEnd: new Date("2026-08-01T00:00:00Z"),
    activatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

/** A recurring "paid" callback, as Grow sends it (form-encoded, bracketed keys). */
function recurringPaidBody(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    "data[directDebitId]": "DD-123",
    "data[statusCode]": "2",
    "data[transactionId]": "txn-new",
    "data[sum]": "249.00",
    "data[paymentSource]": "הוראת קבע",
    ...extra,
  });
  return params.toString();
}

function req(body: string, { withSecret = true, query = "" } = {}): Request {
  const url = withSecret
    ? `http://localhost/api/subscription/webhook?t=${encodeURIComponent(SECRET)}${query}`
    : `http://localhost/api/subscription/webhook${query ? `?${query.replace(/^&/, "")}` : ""}`;
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

beforeEach(() => {
  resetPrismaMock(prisma);
  confirmSubscriptionPayment.mockReset().mockResolvedValue({ alreadyApplied: false });
  markRenewalFailed.mockReset().mockResolvedValue({ lapsed: false });
  approveTransaction.mockReset().mockResolvedValue(true);
  vi.stubEnv("SUBSCRIPTION_WEBHOOK_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/subscription/webhook — sender authentication", () => {
  it("401s an unauthenticated recurring callback and activates nothing", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const res = await POST(req(recurringPaidBody(), { withSecret: false }));
    expect(res.status).toBe(401);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
    // Not even looked up — the gate runs before any DB work.
    expect(prisma.accountSubscription.findFirst).not.toHaveBeenCalled();
  });

  it("401s a callback presenting the wrong secret", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const url = "http://localhost/api/subscription/webhook?t=wrong-secret";
    const res = await POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: recurringPaidBody(),
      }),
    );
    expect(res.status).toBe(401);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  // Fail closed: an unset secret must reject everything, not accept everything.
  it("401s every callback when the endpoint secret is not configured", async () => {
    vi.stubEnv("SUBSCRIPTION_WEBHOOK_SECRET", "");
    const res = await POST(req(recurringPaidBody()));
    expect(res.status).toBe(401);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  it("accepts the secret via the x-allura-webhook-secret header too", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const res = await POST(
      new Request("http://localhost/api/subscription/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-allura-webhook-secret": SECRET,
        },
        body: recurringPaidBody(),
      }),
    );
    expect(res.status).toBe(200);
    expect(confirmSubscriptionPayment).toHaveBeenCalled();
  });

  it("activates an authenticated recurring charge", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const res = await POST(req(recurringPaidBody()));
    expect(res.status).toBe(200);
    expect(confirmSubscriptionPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub_1" }),
      expect.objectContaining({ transactionId: "txn-new" }),
    );
  });
});

describe("POST /api/subscription/webhook — amount verification", () => {
  // A standing order left running at the OLD plan's price must not activate the
  // new, more expensive plan.
  it("ignores a charge whose amount does not match the authorized price", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(
      activeSub({ priceMinor: 24900 }),
    );
    const res = await POST(
      req(recurringPaidBody({ "data[sum]": "149.00" })), // Premium price, Platinum row
    );
    expect(res.status).toBe(200); // ack so Grow stops retrying
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  it("accepts a charge that matches the authorized price", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(
      activeSub({ priceMinor: 14900, plan: "premium" }),
    );
    const res = await POST(req(recurringPaidBody({ "data[sum]": "149.00" })));
    expect(res.status).toBe(200);
    expect(confirmSubscriptionPayment).toHaveBeenCalled();
  });
});

describe("POST /api/subscription/webhook — cancelled/expired subscriptions", () => {
  // The old guard only applied when the body claimed to be a recurring run, and
  // that marker is derived from attacker-supplied fields — so omitting them
  // resurrected a dead subscription. The guard must not depend on request data.
  it("never revives a cancelled subscription, even without the recurring marker", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(
      activeSub({ status: "cancelled" }),
    );
    const body = new URLSearchParams({
      "data[directDebitId]": "DD-123",
      "data[statusCode]": "2",
      "data[transactionId]": "txn-new",
      "data[sum]": "249.00",
      // paymentSource deliberately omitted → isRecurringRun === false
    }).toString();

    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  it("never revives an expired subscription", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(
      activeSub({ status: "expired" }),
    );
    const res = await POST(req(recurringPaidBody()));
    expect(res.status).toBe(200);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });
});

describe("POST /api/subscription/webhook — failed renewals", () => {
  it("requires authentication before it will lapse a paying subscription", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const failed = recurringPaidBody({ "data[statusCode]": "6" });
    const res = await POST(req(failed, { withSecret: false }));
    expect(res.status).toBe(401);
    expect(markRenewalFailed).not.toHaveBeenCalled();
  });

  it("lapses on an authenticated failed renewal", async () => {
    prisma.accountSubscription.findFirst.mockResolvedValue(activeSub());
    const res = await POST(req(recurringPaidBody({ "data[statusCode]": "6" })));
    expect(res.status).toBe(200);
    expect(markRenewalFailed).toHaveBeenCalled();
  });
});
