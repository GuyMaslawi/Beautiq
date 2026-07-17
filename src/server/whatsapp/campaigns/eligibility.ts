/**
 * Server-side audience + eligibility for bulk WhatsApp marketing campaigns.
 *
 * Eligibility is ALWAYS computed here, on the server, from scoped Client records.
 * The client UI never decides who is eligible and never supplies phone numbers —
 * it may only supply client ids (which are re-scoped to the business) and filters.
 *
 * A marketing campaign send requires ALL of:
 *   1. a valid Israeli WhatsApp number (normalizedPhone)
 *   2. NOT unsubscribed (unsubscribedAt is null)
 *   3. WhatsApp opt-in (whatsappOptIn = true)
 *   4. marketing opt-in (marketingOptIn = true)
 *   5. a unique normalized phone within the campaign (first occurrence wins)
 */

import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { isValidIsraeliPhone } from "@/lib/phone";

export type ExclusionReason =
  | "invalid_phone"
  | "missing_optin"
  | "unsubscribed"
  | "duplicate_phone"
  | "missing_template_data"
  | "blocked";

export type RecipientClassification = "eligible" | ExclusionReason;

export interface CandidateClient {
  id: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  unsubscribedAt: Date | null;
}

export interface ClassifiedRecipient {
  clientId: string;
  fullName: string;
  normalizedPhone: string;
  classification: RecipientClassification;
}

export interface AudienceInput {
  mode: "all_eligible" | "manual";
  /** Only for mode="manual" — client ids the owner picked (re-scoped to business). */
  clientIds?: string[];
  filters?: {
    /** Visited within the last N days (lastVisitAt >= now - N). */
    visitedWithinDays?: number;
    /** Has not returned for at least N days (lastVisitAt < now - N, or never). */
    notReturnedDays?: number;
    /** true = only clients with a future booking; false = only without; undefined = ignore. */
    hasFutureBooking?: boolean;
    /** Free-text search on name / phone. */
    search?: string;
  };
}

export interface AudienceResult {
  eligible: ClassifiedRecipient[];
  excluded: ClassifiedRecipient[];
  /** All classified recipients (eligible + excluded), snapshot order. */
  all: ClassifiedRecipient[];
  counts: {
    totalSelected: number;
    eligible: number;
    excluded: number;
    byReason: Record<ExclusionReason, number>;
  };
}

/**
 * Classifies a single candidate for a MARKETING send. Mutates `seenPhones` so the
 * FIRST occurrence of a normalized phone stays eligible and later ones become
 * duplicate_phone — never send more than one message to the same number.
 */
export function classifyCandidate(
  client: CandidateClient,
  seenPhones: Set<string>,
): RecipientClassification {
  if (!client.normalizedPhone || !isValidIsraeliPhone(client.normalizedPhone)) {
    return "invalid_phone";
  }
  if (client.unsubscribedAt) {
    return "unsubscribed";
  }
  // Marketing requires both WhatsApp opt-in and explicit marketing opt-in.
  if (!client.whatsappOptIn || !client.marketingOptIn) {
    return "missing_optin";
  }
  if (seenPhones.has(client.normalizedPhone)) {
    return "duplicate_phone";
  }
  seenPhones.add(client.normalizedPhone);
  return "eligible";
}

const CANDIDATE_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  normalizedPhone: true,
  whatsappOptIn: true,
  marketingOptIn: true,
  unsubscribedAt: true,
} as const;

/**
 * Loads scoped candidate clients for the requested audience, applying filters
 * server-side. Manual mode re-scopes the supplied ids to the business (foreign
 * ids are silently dropped — never trusted).
 */
async function loadCandidates(
  tenant: TenantContext,
  input: AudienceInput,
): Promise<CandidateClient[]> {
  const where: Record<string, unknown> = { businessId: tenant.businessId };

  if (input.mode === "manual") {
    const ids = [
      ...new Set((input.clientIds ?? []).filter((id) => typeof id === "string" && id.length > 0)),
    ];
    if (ids.length === 0) return [];
    where.id = { in: ids };
  }

  const filters = input.filters ?? {};

  if (typeof filters.visitedWithinDays === "number" && filters.visitedWithinDays > 0) {
    const since = new Date(Date.now() - filters.visitedWithinDays * 24 * 60 * 60 * 1000);
    where.lastVisitAt = { gte: since };
  }

  if (typeof filters.notReturnedDays === "number" && filters.notReturnedDays > 0) {
    const before = new Date(Date.now() - filters.notReturnedDays * 24 * 60 * 60 * 1000);
    // "not returned" = last visit older than the threshold OR never visited.
    where.OR = [{ lastVisitAt: { lt: before } }, { lastVisitAt: null }];
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.AND = [
      {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { phone: { contains: term } },
          { normalizedPhone: { contains: term } },
        ],
      },
    ];
  }

  let candidates = (await prisma.client.findMany({
    where,
    select: CANDIDATE_SELECT,
    orderBy: { createdAt: "asc" },
  })) as CandidateClient[];

  // Future-booking filter needs a join; apply it after loading candidates.
  if (typeof filters.hasFutureBooking === "boolean") {
    const now = new Date();
    const withFuture = await prisma.booking.findMany({
      where: {
        businessId: tenant.businessId,
        clientId: { in: candidates.map((c) => c.id) },
        startTime: { gt: now },
        status: { in: ["pending", "approved"] },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    const futureSet = new Set(withFuture.map((b) => b.clientId));
    candidates = candidates.filter((c) =>
      filters.hasFutureBooking ? futureSet.has(c.id) : !futureSet.has(c.id),
    );
  }

  return candidates;
}

/**
 * Builds the full campaign audience: loads scoped candidates, classifies every
 * one, and returns eligible + excluded with counts. Purely read-only.
 */
export async function buildCampaignAudience(
  tenant: TenantContext,
  input: AudienceInput,
): Promise<AudienceResult> {
  const candidates = await loadCandidates(tenant, input);

  const seenPhones = new Set<string>();
  const all: ClassifiedRecipient[] = candidates.map((c) => ({
    clientId: c.id,
    fullName: c.fullName,
    normalizedPhone: c.normalizedPhone,
    classification: classifyCandidate(c, seenPhones),
  }));

  const eligible = all.filter((r) => r.classification === "eligible");
  const excluded = all.filter((r) => r.classification !== "eligible");

  const byReason: Record<ExclusionReason, number> = {
    invalid_phone: 0,
    missing_optin: 0,
    unsubscribed: 0,
    duplicate_phone: 0,
    missing_template_data: 0,
    blocked: 0,
  };
  for (const r of excluded) {
    byReason[r.classification as ExclusionReason]++;
  }

  return {
    eligible,
    excluded,
    all,
    counts: {
      totalSelected: all.length,
      eligible: eligible.length,
      excluded: excluded.length,
      byReason,
    },
  };
}
