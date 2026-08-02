import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Admin-set monthly price (src/server/admin/account-actions.ts).
 *
 * An admin can negotiate what a specific business owner pays every month. That
 * amount must become the REAL recurring bill — not a label: it has to reach the
 * billing row (which every renewal and the ledger read), and, when a standing
 * order is already running at a different amount, the old order must be stopped
 * so Grow never keeps charging the previous price. These tests pin exactly that.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

vi.mock("@/server/admin/auth", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/activity/log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const isGrowConfigured = vi.fn();
const cancelDirectDebit = vi.fn();
vi.mock("@/lib/subscription/grow", () => ({
  isGrowConfigured: () => isGrowConfigured(),
  cancelDirectDebit: (...a: unknown[]) => cancelDirectDebit(...(a as [])),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { adminSetCustomPriceAction } from "@/server/admin/account-actions";

const BIZ = "biz_1";
const OWNER_ID = "user_1";

/** The owner as returned by the ownership lookup. */
function owner(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: OWNER_ID,
      name: "בעלת העסק",
      email: "owner@example.com",
      isAdmin: false,
      plan: "standard",
      customPriceMinor: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  isGrowConfigured.mockReset().mockReturnValue(true);
  cancelDirectDebit.mockReset().mockResolvedValue(true);
  prisma.businessUser.findFirst.mockResolvedValue(owner());
  prisma.user.update.mockResolvedValue({});
  prisma.accountSubscription.findUnique.mockResolvedValue(null);
  prisma.accountSubscription.update.mockResolvedValue({});
});

describe("adminSetCustomPriceAction", () => {
  it("stores the negotiated price on the account", async () => {
    const res = await adminSetCustomPriceAction(BIZ, OWNER_ID, 99);

    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      data: { customPriceMinor: 9900 },
    });
  });

  it("pushes the new amount onto the billing row so renewals charge it", async () => {
    prisma.accountSubscription.findUnique.mockResolvedValue({
      id: "sub_1",
      status: "active",
      directDebitId: null, // authorized outside Grow / dev — nothing to stop
      priceMinor: 19900,
    });

    await adminSetCustomPriceAction(BIZ, OWNER_ID, 99);

    expect(prisma.accountSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { plan: "standard", priceMinor: 9900 },
    });
  });

  it("stops a live standing order that is charging the old amount", async () => {
    prisma.accountSubscription.findUnique.mockResolvedValue({
      id: "sub_1",
      status: "active",
      directDebitId: "dd_123",
      priceMinor: 19900,
    });

    const res = await adminSetCustomPriceAction(BIZ, OWNER_ID, 99);

    // Grow cannot edit a standing order's amount, so the old one must die.
    expect(cancelDirectDebit).toHaveBeenCalledWith("dd_123");
    expect(prisma.accountSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.objectContaining({
        priceMinor: 9900,
        status: "pending",
        directDebitId: null,
      }),
    });
    // The admin is told the owner must re-authorize her card.
    expect(res.message).toContain("לאשר");
  });

  it("leaves a live standing order alone when the amount is unchanged", async () => {
    prisma.accountSubscription.findUnique.mockResolvedValue({
      id: "sub_1",
      status: "active",
      directDebitId: "dd_123",
      priceMinor: 9900,
    });

    await adminSetCustomPriceAction(BIZ, OWNER_ID, 99);

    expect(cancelDirectDebit).not.toHaveBeenCalled();
  });

  it("clears the override back to the plan list price", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(owner({ customPriceMinor: 9900 }));
    prisma.accountSubscription.findUnique.mockResolvedValue({
      id: "sub_1",
      status: "active",
      directDebitId: null,
      priceMinor: 9900,
    });

    const res = await adminSetCustomPriceAction(BIZ, OWNER_ID, null);

    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      data: { customPriceMinor: null },
    });
    expect(prisma.accountSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { plan: "standard", priceMinor: 19900 },
    });
  });

  it("accepts a price for an owner who has not paid yet — it applies at checkout", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(owner({ plan: null }));

    const res = await adminSetCustomPriceAction(BIZ, OWNER_ID, 120);

    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OWNER_ID },
      data: { customPriceMinor: 12000 },
    });
    // No plan → no billing row to touch.
    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
  });

  it.each([0, -50, 20000, Number.NaN])("rejects an out-of-range price (%s)", async (price) => {
    const res = await adminSetCustomPriceAction(BIZ, OWNER_ID, price);

    expect(res.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("never touches an account that is not the owner of this business", async () => {
    prisma.businessUser.findFirst.mockResolvedValue(null);

    const res = await adminSetCustomPriceAction(BIZ, "someone_else", 99);

    expect(res.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
