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

const send = vi.fn();
const getWhatsAppProviderForBusiness = vi.fn(async () => ({ send }));
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: (...a: unknown[]) =>
    (getWhatsAppProviderForBusiness as (...a: unknown[]) => unknown)(...a),
}));

const TEMPLATE = {
  name: "win_back_offer_he",
  language: "he",
  category: "MARKETING" as const,
  label: "החזרת לקוחות",
  variableNames: ["clientName", "businessName"],
  body: "היי {{1}} מ{{2}}",
  example: [],
  status: "approved" as const,
  available: true,
  isAlluraManaged: true,
};
vi.mock("@/server/whatsapp/campaigns/template", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, getMarketingCampaignTemplate: vi.fn(async () => TEMPLATE) };
});

import { processCampaignBatch } from "@/server/whatsapp/campaigns/processor";

function eligibleClient(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "נועה כהן",
    normalizedPhone: "+972501234567",
    whatsappOptIn: true,
    marketingOptIn: true,
    unsubscribedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset();
  getWhatsAppProviderForBusiness.mockClear().mockResolvedValue({ send });
  delete process.env.WHATSAPP_TEST_MODE;

  // Default happy-path mocks.
  prisma.whatsAppCampaign.updateMany.mockResolvedValue({ count: 1 }); // claim + others
  prisma.whatsAppCampaign.findUnique.mockResolvedValue({ variablePayload: null });
  prisma.business.findUnique.mockResolvedValue({ name: "סטודיו יופי" });
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
  prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
  prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
  prisma.whatsAppCampaignRecipient.update.mockResolvedValue({ id: "r" });
  prisma.client.findFirst.mockResolvedValue(eligibleClient());
});

describe("processCampaignBatch", () => {
  it("only ever selects queued recipients (accepted are never re-sent)", async () => {
    prisma.whatsAppCampaignRecipient.findMany.mockResolvedValue([]);
    prisma.whatsAppCampaignRecipient.count.mockResolvedValue(0);
    prisma.whatsAppCampaignRecipient.groupBy.mockResolvedValue([]);

    await processCampaignBatch("camp_1", BUSINESS_A);

    const arg = prisma.whatsAppCampaignRecipient.findMany.mock.calls[0][0] as {
      where: { campaignId: string; status: string };
    };
    expect(arg.where.status).toBe("queued");
    expect(arg.where.campaignId).toBe("camp_1");
  });

  it("returns busy without sending when the lock cannot be acquired", async () => {
    prisma.whatsAppCampaign.updateMany.mockResolvedValueOnce({ count: 0 }); // claim fails
    prisma.whatsAppCampaign.findFirst.mockResolvedValue({ status: "processing" });
    prisma.whatsAppCampaignRecipient.groupBy.mockResolvedValue([]);

    const res = await processCampaignBatch("camp_1", BUSINESS_A);
    expect(res.busy).toBe(true);
    expect(res.done).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("continues past a failing recipient and finalizes completed_with_errors", async () => {
    prisma.whatsAppCampaignRecipient.findMany.mockResolvedValue([
      { id: "r1", clientId: "c1" },
      { id: "r2", clientId: "c2" },
    ]);
    // finalizeIfDrained: remaining=0, failed=1
    prisma.whatsAppCampaignRecipient.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    prisma.whatsAppCampaignRecipient.groupBy.mockResolvedValue([
      { status: "accepted", _count: { _all: 1 } },
      { status: "failed", _count: { _all: 1 } },
    ]);

    send
      .mockResolvedValueOnce({ success: true, providerMessageId: "wamid.1" })
      .mockResolvedValueOnce({ success: false, failureReason: "boom", metaError: { code: 1 } });

    const res = await processCampaignBatch("camp_1", BUSINESS_A);

    // Both recipients attempted — one failure did NOT abort the batch.
    expect(send).toHaveBeenCalledTimes(2);
    // Uses the per-business resolved provider.
    expect(getWhatsAppProviderForBusiness).toHaveBeenCalledWith(BUSINESS_A);
    expect(res.status).toBe("completed_with_errors");
    expect(res.done).toBe(true);

    // One recipient accepted (wamid stored), one failed.
    const updates = prisma.whatsAppCampaignRecipient.update.mock.calls.map(
      (c) => (c[0] as { data: { status?: string } }).data.status,
    );
    expect(updates).toContain("accepted");
    expect(updates).toContain("failed");
  });

  it("re-checks suppression and skips a now-unsubscribed recipient without sending", async () => {
    prisma.whatsAppCampaignRecipient.findMany.mockResolvedValue([
      { id: "r1", clientId: "c1" },
    ]);
    prisma.client.findFirst.mockResolvedValue(
      eligibleClient({ unsubscribedAt: new Date() }),
    );
    prisma.whatsAppCampaignRecipient.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.whatsAppCampaignRecipient.groupBy.mockResolvedValue([
      { status: "skipped", _count: { _all: 1 } },
    ]);

    await processCampaignBatch("camp_1", BUSINESS_A);

    expect(send).not.toHaveBeenCalled();
    const skipCall = prisma.whatsAppCampaignRecipient.update.mock.calls.find(
      (c) => (c[0] as { data: { status?: string } }).data.status === "skipped",
    );
    expect(skipCall).toBeTruthy();
  });
});
