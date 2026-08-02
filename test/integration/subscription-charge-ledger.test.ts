import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * The billing ledger (SubscriptionCharge) is the ONLY historical record of
 * owner→Allura money. AccountSubscription keeps just the current state — a
 * renewal overwrites the last transaction id, a new failure overwrites the last
 * failure reason — so if these writes regress, past charges become unknowable.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  confirmSubscriptionPayment,
  markRenewalFailed,
} from "@/server/subscription/service";

const SUB = {
  id: "sub_1",
  userId: "usr_1",
  plan: "standard" as const,
  priceMinor: 24900,
  providerTransactionId: null,
  currentPeriodEnd: null,
  activatedAt: null,
};

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.$transaction.mockResolvedValue([]);
  prisma.subscriptionCharge.create.mockResolvedValue({});
  prisma.accountSubscription.update.mockResolvedValue({});
});

describe("subscription charge ledger", () => {
  it("records a paid row with the authorized amount on a confirmed payment", async () => {
    await confirmSubscriptionPayment(SUB, {
      transactionId: "txn_abc",
      directDebitId: "dd_1",
      cardSuffix: "4242",
    });

    expect(prisma.subscriptionCharge.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.subscriptionCharge.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      userId: "usr_1",
      subscriptionId: "sub_1",
      plan: "standard",
      // The price we authorized — never a number echoed back by the provider.
      amountMinor: 24900,
      outcome: "paid",
      providerTransactionId: "txn_abc",
      cardSuffix: "4242",
      isRecurring: false,
    });
  });

  it("marks an automatic monthly run as recurring", async () => {
    await confirmSubscriptionPayment(SUB, {
      transactionId: "txn_renewal",
      isRecurring: true,
    });

    const { data } = prisma.subscriptionCharge.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.isRecurring).toBe(true);
  });

  it("writes nothing when the same charge is applied twice (webhook retry)", async () => {
    await confirmSubscriptionPayment(
      { ...SUB, providerTransactionId: "txn_abc" },
      { transactionId: "txn_abc" },
    );

    expect(prisma.subscriptionCharge.create).not.toHaveBeenCalled();
  });

  it("records a failed renewal so a later success cannot erase it", async () => {
    prisma.accountSubscription.update.mockResolvedValue({});

    await markRenewalFailed(
      { ...SUB, currentPeriodEnd: new Date(Date.now() + 86_400_000) },
      "direct debit not approved (status 5)",
    );

    const { data } = prisma.subscriptionCharge.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      outcome: "failed",
      isRecurring: true,
      amountMinor: 24900,
    });
    expect(String(data.failureReason)).toContain("not approved");
  });

  it("never lets a ledger write failure block a real payment", async () => {
    prisma.subscriptionCharge.create.mockRejectedValue(new Error("db down"));

    await expect(
      confirmSubscriptionPayment(SUB, { transactionId: "txn_xyz" }),
    ).resolves.toEqual({ alreadyApplied: false });
  });
});
