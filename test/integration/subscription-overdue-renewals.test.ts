import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * The silent leak this guards against: Grow charges the standing order and
 * re-notifies our webhook, which extends the period. If that notification never
 * arrives — standing order stopped, card dead, callback rejected — the row stays
 * `active` with a period end in the past, `User.plan` stays set, and the owner
 * keeps full access for free forever. The daily sweep only ever looked at
 * `cancelled` and `past_due`, so nothing saw it.
 *
 * These tests pin the query itself, because the whole detection is the filter:
 * a wrong status or a missing grace window silently detects nothing (leak stays
 * invisible) or everything (alerts every paying customer on renewal day).
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
  countOverdueRenewals,
  findOverdueRenewals,
  RENEWAL_GRACE_DAYS,
} from "@/server/subscription/service";

const NOW = new Date("2026-08-04T12:00:00.000Z");
const DAY = 86_400_000;

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.accountSubscription.count.mockResolvedValue(0);
  prisma.accountSubscription.findMany.mockResolvedValue([]);
});

describe("overdue renewal detection", () => {
  it("looks only at ACTIVE subscriptions — cancelled/past_due are the sweep's job", async () => {
    await countOverdueRenewals(NOW);

    const { where } = prisma.accountSubscription.count.mock.calls[0][0] as {
      where: { status: string };
    };
    expect(where.status).toBe("active");
  });

  it("allows a grace window before calling a renewal missing", async () => {
    await countOverdueRenewals(NOW);

    const { where } = prisma.accountSubscription.count.mock.calls[0][0] as {
      where: { currentPeriodEnd: { lt: Date } };
    };
    // A customer whose period ends today must NOT be flagged: Grow's charge and
    // its notification land on the day itself, not before it.
    expect(where.currentPeriodEnd.lt.getTime()).toBe(
      NOW.getTime() - RENEWAL_GRACE_DAYS * DAY,
    );
    expect(where.currentPeriodEnd.lt.getTime()).toBeLessThan(NOW.getTime());
  });

  it("returns the identifying details needed to chase a charge in Grow", async () => {
    prisma.accountSubscription.findMany.mockResolvedValue([
      {
        id: "sub_1",
        userId: "usr_1",
        currentPeriodEnd: new Date(NOW.getTime() - 10 * DAY),
        directDebitId: "dd_1",
        lastChargeAt: new Date(NOW.getTime() - 40 * DAY),
        user: { email: "owner@example.com" },
      },
    ]);

    const rows = await findOverdueRenewals(NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ directDebitId: "dd_1" });
    const args = prisma.accountSubscription.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
      orderBy: { currentPeriodEnd: string };
    };
    expect(args.select.directDebitId).toBe(true);
    // Oldest first: the longest-running leak is the one worth looking at first.
    expect(args.orderBy.currentPeriodEnd).toBe("asc");
  });

  it("never writes — detection must not revoke access on an unverified signal", async () => {
    await findOverdueRenewals(NOW);
    await countOverdueRenewals(NOW);

    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
    expect(prisma.accountSubscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
