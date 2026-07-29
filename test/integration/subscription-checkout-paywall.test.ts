import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The paywall must never give a plan away (src/server/subscription/actions.ts).
 *
 * Every business owner pays the full plan price. `User.plan` may only be set by a
 * payment Grow confirmed server-side, or by a deliberate admin grant. The dev
 * shortcut that activates a plan locally with no charge keeps the app runnable
 * without Grow — and would silently turn production into a giveaway if a
 * deployment were missing SUBSCRIPTIONS_ENABLED / the Make webhook URL. These
 * tests pin the production block, and pin that local dev still works.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

const requireCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentUser: () => requireCurrentUser(),
}));

const isGrowConfigured = vi.fn();
const createPaymentLink = vi.fn();
const cancelDirectDebit = vi.fn();
vi.mock("@/lib/subscription/grow", () => ({
  isGrowConfigured: () => isGrowConfigured(),
  createPaymentLink: (...a: unknown[]) => createPaymentLink(...(a as [])),
  cancelDirectDebit: (...a: unknown[]) => cancelDirectDebit(...(a as [])),
}));

const confirmSubscriptionPayment = vi.fn();
vi.mock("@/server/subscription/service", () => ({
  confirmSubscriptionPayment: (...a: unknown[]) => confirmSubscriptionPayment(...(a as [])),
  planPriceMinor: () => 14900,
  // The real rule: an admin-negotiated price replaces the list price.
  effectivePriceMinor: (_plan: string, custom: number | null | undefined) =>
    typeof custom === "number" ? custom : 14900,
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { startSubscriptionCheckoutAction } from "@/server/subscription/actions";

const USER = { id: "user_1", email: "owner@example.com", name: "בעלת עסק", plan: null };

beforeEach(() => {
  // Checkout is rate-limited per account and the in-memory counter is
  // module-level, so it survives between test cases. Without this reset the
  // suite's own repeated calls eventually trip the limit and a later test fails
  // for a reason that has nothing to do with what it asserts.
  __resetRateLimitForTests();
  resetPrismaMock(prisma);
  requireCurrentUser.mockReset().mockResolvedValue(USER);
  isGrowConfigured.mockReset().mockReturnValue(false);
  createPaymentLink.mockReset();
  cancelDirectDebit.mockReset().mockResolvedValue(true);
  confirmSubscriptionPayment.mockReset().mockResolvedValue({ alreadyApplied: false });
  prisma.accountSubscription.findUnique.mockResolvedValue(null);
  prisma.accountSubscription.upsert.mockResolvedValue({ id: "sub_1", userId: USER.id });
  prisma.accountSubscription.update.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("startSubscriptionCheckoutAction — production paywall", () => {
  it("refuses to activate a plan in production when billing is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    isGrowConfigured.mockReturnValue(false);

    const res = await startSubscriptionCheckoutAction("platinum");

    expect(res.ok).toBe(false);
    expect(res.redirectUrl).toBeUndefined();
    // The whole point: no plan is granted.
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  it("bails out before writing anything, so a live standing order is not cleared", async () => {
    vi.stubEnv("NODE_ENV", "production");
    isGrowConfigured.mockReturnValue(false);

    await startSubscriptionCheckoutAction("premium");

    // The checkout path resets the subscription row (directDebitId: null). Bailing
    // out after that would detach a paying customer from her monthly charge.
    expect(prisma.accountSubscription.upsert).not.toHaveBeenCalled();
    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
    expect(cancelDirectDebit).not.toHaveBeenCalled();
  });

  it("shows the owner a Hebrew, retryable message rather than a raw failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    isGrowConfigured.mockReturnValue(false);

    const res = await startSubscriptionCheckoutAction("platinum");

    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/[֐-׿]/); // Hebrew, per CLAUDE.md §5
    expect(res.error).not.toMatch(/SUBSCRIPTIONS_ENABLED|webhook|undefined/i);
  });

  it("rejects an invalid plan id before anything else", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await startSubscriptionCheckoutAction("free");

    expect(res.ok).toBe(false);
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });

  it("sends the owner to Grow's hosted page when billing IS configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    isGrowConfigured.mockReturnValue(true);
    createPaymentLink.mockResolvedValue({
      paymentUrl: "https://grow.example/pay/abc",
      processId: "p1",
      processToken: "t1",
    });

    const res = await startSubscriptionCheckoutAction("platinum");

    expect(res.ok).toBe(true);
    expect(res.redirectUrl).toBe("https://grow.example/pay/abc");
    // Access opens only when Grow confirms the charge, never from this call.
    expect(confirmSubscriptionPayment).not.toHaveBeenCalled();
  });
});

describe("startSubscriptionCheckoutAction — admin-negotiated price", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    isGrowConfigured.mockReturnValue(true);
    createPaymentLink.mockResolvedValue({
      paymentUrl: "https://grow.example/pay/abc",
      processId: "p1",
      processToken: "t1",
    });
  });

  it("charges the owner's custom price, not the plan list price", async () => {
    // A distinct user id per test — checkout is rate-limited per account.
    requireCurrentUser.mockResolvedValue({
      ...USER,
      id: "user_custom",
      customPriceMinor: 9900,
    });

    await startSubscriptionCheckoutAction("platinum");

    // What Grow is told to collect — and what the recurring standing order
    // will therefore be authorized for.
    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 9900 }),
    );
    // ...and what the billing row records, so renewals match the charge.
    expect(prisma.accountSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ priceMinor: 9900 }),
        update: expect.objectContaining({ priceMinor: 9900 }),
      }),
    );
  });

  it("falls back to the list price when no custom price is set", async () => {
    requireCurrentUser.mockResolvedValue({ ...USER, id: "user_listprice" });

    await startSubscriptionCheckoutAction("platinum");

    expect(createPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 14900 }),
    );
  });
});

describe("startSubscriptionCheckoutAction — local development", () => {
  it("still activates instantly outside production so the app runs without Grow", async () => {
    isGrowConfigured.mockReturnValue(false); // NODE_ENV is "test" here

    const res = await startSubscriptionCheckoutAction("premium");

    expect(res.ok).toBe(true);
    expect(res.redirectUrl).toBe("/dashboard");
    expect(confirmSubscriptionPayment).toHaveBeenCalledTimes(1);
  });
});
