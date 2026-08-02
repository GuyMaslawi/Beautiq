/**
 * Admin read model for the owner→Allura billing ledger (SubscriptionCharge).
 *
 * AccountSubscription only ever holds the CURRENT state — a renewal overwrites
 * the last transaction id and a new failure overwrites the last failure reason.
 * These queries read the append-only ledger instead, so the admin can see what
 * was actually collected and when, including attempts that later succeeded.
 *
 * Platform-admin only; every caller sits behind requirePlatformAdmin().
 */

import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@prisma/client";

export type ChargeOutcomeFilter = "all" | "paid" | "failed";
export type ChargeKindFilter = "all" | "first" | "recurring";

export interface AdminChargeRow {
  id: string;
  occurredAtISO: string;
  ownerName: string | null;
  ownerEmail: string;
  userId: string;
  businessName: string | null;
  businessId: string | null;
  /** Amount in shekels. */
  amount: number;
  outcome: "paid" | "failed";
  isRecurring: boolean;
  cardSuffix: string | null;
  providerTransactionId: string | null;
  failureReason: string | null;
}

export interface AdminChargeTotals {
  /** Lifetime cash actually collected, in shekels — only `paid` rows. */
  collected: number;
  paidCount: number;
  failedCount: number;
  /** Collected within the current calendar month, in shekels. */
  collectedThisMonth: number;
}

export interface AdminChargesResult {
  rows: AdminChargeRow[];
  totals: AdminChargeTotals;
  /** True when more rows exist beyond the returned page. */
  hasMore: boolean;
}

const PAGE_SIZE = 100;

function buildWhere(
  outcome: ChargeOutcomeFilter,
  kind: ChargeKindFilter,
  q?: string,
): Prisma.SubscriptionChargeWhereInput {
  const where: Prisma.SubscriptionChargeWhereInput = {};
  if (outcome !== "all") where.outcome = outcome;
  if (kind !== "all") where.isRecurring = kind === "recurring";

  const term = q?.trim();
  if (term) {
    where.user = {
      OR: [
        { email: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { memberships: { some: { business: { name: { contains: term, mode: "insensitive" } } } } },
      ],
    };
  }
  return where;
}

/**
 * One page of the ledger, newest first, plus lifetime totals.
 *
 * The totals are computed over the SAME filter as the rows so the header always
 * describes what is on screen — a total that silently ignored the active filter
 * would be worse than no total at all.
 */
export async function getAdminCharges(params: {
  outcome?: ChargeOutcomeFilter;
  kind?: ChargeKindFilter;
  q?: string;
  page?: number;
}): Promise<AdminChargesResult> {
  const outcome = params.outcome ?? "all";
  const kind = params.kind ?? "all";
  const page = Math.max(0, params.page ?? 0);
  const where = buildWhere(outcome, kind, params.q);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [charges, paidAgg, failedCount, monthAgg] = await Promise.all([
    prisma.subscriptionCharge.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: page * PAGE_SIZE,
      // One extra row tells us whether a next page exists without a second count.
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        occurredAt: true,
        amountMinor: true,
        outcome: true,
        isRecurring: true,
        cardSuffix: true,
        providerTransactionId: true,
        failureReason: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
            memberships: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { business: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.subscriptionCharge.aggregate({
      where: { ...where, outcome: "paid" },
      _sum: { amountMinor: true },
      _count: true,
    }),
    prisma.subscriptionCharge.count({ where: { ...where, outcome: "failed" } }),
    prisma.subscriptionCharge.aggregate({
      where: { ...where, outcome: "paid", occurredAt: { gte: monthStart } },
      _sum: { amountMinor: true },
    }),
  ]);

  const hasMore = charges.length > PAGE_SIZE;
  const pageRows = hasMore ? charges.slice(0, PAGE_SIZE) : charges;

  return {
    rows: pageRows.map((c) => {
      const business = c.user.memberships[0]?.business ?? null;
      return {
        id: c.id,
        occurredAtISO: c.occurredAt.toISOString(),
        ownerName: c.user.name,
        ownerEmail: c.user.email,
        userId: c.userId,
        businessName: business?.name ?? null,
        businessId: business?.id ?? null,
        amount: c.amountMinor / 100,
        outcome: c.outcome,
        isRecurring: c.isRecurring,
        cardSuffix: c.cardSuffix,
        providerTransactionId: c.providerTransactionId,
        failureReason: c.failureReason,
      };
    }),
    totals: {
      collected: (paidAgg._sum.amountMinor ?? 0) / 100,
      paidCount: paidAgg._count,
      failedCount,
      collectedThisMonth: (monthAgg._sum.amountMinor ?? 0) / 100,
    },
    hasMore,
  };
}
