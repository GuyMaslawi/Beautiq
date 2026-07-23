import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

import {
  classifyCandidate,
  buildCampaignAudience,
  type CandidateClient,
} from "@/server/whatsapp/campaigns/eligibility";

function candidate(overrides: Partial<CandidateClient> = {}): CandidateClient {
  return {
    id: "cli_1",
    fullName: "נועה כהן",
    phone: "050-123-4567",
    normalizedPhone: "+972501234567",
    whatsappOptIn: true,
    marketingOptIn: true,
    unsubscribedAt: null,
    ...overrides,
  };
}

const tenant = { businessId: BUSINESS_A };

describe("classifyCandidate", () => {
  it("marks a fully eligible client eligible and records the phone", () => {
    const seen = new Set<string>();
    expect(classifyCandidate(candidate(), seen)).toBe("eligible");
    expect(seen.has("+972501234567")).toBe(true);
  });

  it("rejects an invalid phone", () => {
    expect(classifyCandidate(candidate({ normalizedPhone: "+972123" }), new Set())).toBe(
      "invalid_phone",
    );
  });

  it("rejects an unsubscribed client", () => {
    expect(
      classifyCandidate(candidate({ unsubscribedAt: new Date() }), new Set()),
    ).toBe("unsubscribed");
  });

  it("no longer excludes a client for a missing WhatsApp opt-in (opt-in not required)", () => {
    // Consent is no longer gated per-message — only an explicit STOP (unsubscribedAt) excludes.
    expect(classifyCandidate(candidate({ whatsappOptIn: false }), new Set())).toBe(
      "eligible",
    );
  });

  it("no longer excludes a client for a missing marketing opt-in (opt-in not required)", () => {
    expect(classifyCandidate(candidate({ marketingOptIn: false }), new Set())).toBe(
      "eligible",
    );
  });

  it("marks a second occurrence of the same phone as duplicate", () => {
    const seen = new Set<string>();
    expect(classifyCandidate(candidate({ id: "a" }), seen)).toBe("eligible");
    expect(classifyCandidate(candidate({ id: "b" }), seen)).toBe("duplicate_phone");
  });
});

describe("buildCampaignAudience", () => {
  beforeEach(() => resetPrismaMock(prisma));

  it("classifies, dedupes and counts server-side", async () => {
    prisma.client.findMany.mockResolvedValue([
      candidate({ id: "a", normalizedPhone: "+972500000001" }),
      candidate({ id: "b", normalizedPhone: "+972500000001" }), // duplicate phone
      // Missing marketing opt-in is NO LONGER an exclusion — this client stays eligible.
      candidate({ id: "c", normalizedPhone: "+972500000002", marketingOptIn: false }),
      candidate({ id: "d", normalizedPhone: "+972500000003", unsubscribedAt: new Date() }),
      candidate({ id: "e", normalizedPhone: "+972500000004" }),
    ]);

    const res = await buildCampaignAudience(tenant, { mode: "all_eligible" });

    expect(res.counts.eligible).toBe(3); // a, c, e
    expect(res.counts.excluded).toBe(2); // b (dup), d (unsub)
    expect(res.counts.byReason.duplicate_phone).toBe(1);
    expect(res.counts.byReason.unsubscribed).toBe(1);
  });

  it("scopes every query by businessId", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await buildCampaignAudience(tenant, { mode: "all_eligible" });
    const arg = prisma.client.findMany.mock.calls[0][0] as { where: { businessId: string } };
    expect(arg.where.businessId).toBe(BUSINESS_A);
  });

  it("manual mode re-scopes supplied ids to the business (foreign ids dropped)", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await buildCampaignAudience(tenant, {
      mode: "manual",
      clientIds: ["cli_1", "cli_2", "cli_1"], // dupe id collapsed
    });
    const arg = prisma.client.findMany.mock.calls[0][0] as {
      where: { businessId: string; id: { in: string[] } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.id.in.sort()).toEqual(["cli_1", "cli_2"]);
  });

  it("returns an empty audience for manual mode with no ids (never a full-table scan)", async () => {
    const res = await buildCampaignAudience(tenant, { mode: "manual", clientIds: [] });
    expect(res.counts.totalSelected).toBe(0);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });
});
