import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

import { runReviewRequestForBusiness } from "@/server/review-request/runner";

function completedBookingRow(clientOverrides: Record<string, unknown> = {}) {
  return {
    id: "bkg_1",
    clientId: "cli_1",
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    client: {
      fullName: "דנה",
      normalizedPhone: "+972501234567",
      unsubscribedAt: null,
      whatsappOptIn: true,
      ...clientOverrides,
    },
    service: { name: "מניקור" },
  };
}

const BASE = {
  businessId: BUSINESS_A,
  sendHour: 24,
  bypassTiming: true, // admin: 7-day lookback window
};

let fetchSpy: ReturnType<typeof vi.fn> | undefined;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetPrismaMock(prisma);
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  prisma.business.findUnique.mockResolvedValue({ name: "סטודיו יופי", slug: "studio-yofi" });
  prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
  prisma.automationRun.findFirst.mockResolvedValue(null);
  prisma.messageTemplate.findUnique.mockResolvedValue(null);
  prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: "m1", ...a.data }));
  prisma.automationMessage.update.mockResolvedValue({ id: "m1" });
  prisma.booking.update.mockResolvedValue({ id: "bkg_1" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runReviewRequestForBusiness — no real send", () => {
  it("returns early when no completed bookings are in window", async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    const result = await runReviewRequestForBusiness(BASE);
    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(prisma.automationMessage.create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("queries only completed bookings without a prior review request, scoped to tenant", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    await runReviewRequestForBusiness(BASE);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.businessId).toBe(BUSINESS_A);
    expect(where.status).toBe("completed");
    expect(where.reviewRequestSentAt).toBeNull();
  });

  it("builds Hebrew review text with the review link and marks reviewRequestSentAt", async () => {
    prisma.booking.findMany.mockResolvedValue([completedBookingRow()]);
    const result = await runReviewRequestForBusiness(BASE);
    expect(result.sentCount).toBe(1);
    const created = prisma.automationMessage.create.mock.calls[0][0].data;
    expect(created.messageText).toContain("דנה");
    expect(created.messageText).toContain("ביקורת");
    expect(created.type).toBe("review_request");
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reviewRequestSentAt: expect.any(Date) } }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips an unsubscribed client", async () => {
    prisma.booking.findMany.mockResolvedValue([
      completedBookingRow({ unsubscribedAt: new Date() }),
    ]);
    const result = await runReviewRequestForBusiness(BASE);
    expect(result.skippedCount).toBe(1);
    expect(result.sentCount).toBe(0);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("honours the idempotency guard on the cron path", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({ id: "existing" });
    const result = await runReviewRequestForBusiness({
      businessId: BUSINESS_A,
      sendHour: 24,
      bypassTiming: false,
    });
    expect(result.alreadyRan).toBe(true);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
