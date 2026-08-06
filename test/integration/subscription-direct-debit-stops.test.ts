import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * Grow's Make app cannot cancel a recurring payment — the vendor states it has
 * to be done on the Grow site. So cancelling in Allura closes access while the
 * standing order keeps billing the customer's card, and the only safety net was
 * a single alert email: miss it, and someone who cancelled keeps paying with
 * nothing anywhere to remind you. This list is the durable replacement, so the
 * query behind it has to be exactly right.
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
  countDirectDebitsAwaitingStop,
  findDirectDebitsAwaitingStop,
  markDirectDebitStopped,
} from "@/server/subscription/service";

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.accountSubscription.count.mockResolvedValue(0);
  prisma.accountSubscription.findMany.mockResolvedValue([]);
  prisma.accountSubscription.updateMany.mockResolvedValue({ count: 1 });
});

describe("direct debits awaiting a manual stop", () => {
  it("lists only cancelled/expired subs that still have a live standing order", async () => {
    await countDirectDebitsAwaitingStop();

    const { where } = prisma.accountSubscription.count.mock.calls[0][0] as {
      where: {
        status: { in: string[] };
        directDebitId: { not: null };
        directDebitStoppedAt: null;
      };
    };
    expect(where.status.in).toEqual(["cancelled", "expired"]);
    // A sub with no directDebitId never had a standing order to stop, and one
    // already marked stopped is done — neither belongs on the task list.
    expect(where.directDebitId).toEqual({ not: null });
    expect(where.directDebitStoppedAt).toBeNull();
  });

  it("never lists an ACTIVE subscription — that customer is meant to be billed", async () => {
    await countDirectDebitsAwaitingStop();

    const { where } = prisma.accountSubscription.count.mock.calls[0][0] as {
      where: { status: { in: string[] } };
    };
    expect(where.status.in).not.toContain("active");
    expect(where.status.in).not.toContain("past_due");
  });

  it("surfaces the directDebitId, since that is what you search for in Grow", async () => {
    await findDirectDebitsAwaitingStop();

    const args = prisma.accountSubscription.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
      orderBy: { cancelledAt: string };
    };
    expect(args.select.directDebitId).toBe(true);
    // Oldest cancellation first: it has been wrongly billing the longest.
    expect(args.orderBy.cancelledAt).toBe("asc");
  });

  it("marking as stopped re-applies the same filter, so a live sub cannot be marked", async () => {
    await markDirectDebitStopped("sub_1");

    const args = prisma.accountSubscription.updateMany.mock.calls[0][0] as {
      where: { id: string; status: { in: string[] }; directDebitStoppedAt: null };
      data: { directDebitStoppedAt: Date };
    };
    expect(args.where.id).toBe("sub_1");
    expect(args.where.status.in).toEqual(["cancelled", "expired"]);
    // Re-checking directDebitStoppedAt is what makes a double-click idempotent.
    expect(args.where.directDebitStoppedAt).toBeNull();
    expect(args.data.directDebitStoppedAt).toBeInstanceOf(Date);
  });

  it("reports failure when nothing matched, rather than a silent success", async () => {
    prisma.accountSubscription.updateMany.mockResolvedValue({ count: 0 });

    await expect(markDirectDebitStopped("sub_live")).resolves.toBe(false);
  });
});
