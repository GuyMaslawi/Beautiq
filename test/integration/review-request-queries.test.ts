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
  getReviewRequestSetting,
  getReviewRequestStatsThisMonth,
  getLastReviewRequestRun,
} from "@/server/review-request/queries";

const tenant = { businessId: BUSINESS_A };

beforeEach(() => resetPrismaMock(prisma));

describe("getReviewRequestSetting", () => {
  it("looks up scoped by business + review_request type", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({ id: "as_1" });
    const res = await getReviewRequestSetting(tenant);
    expect(res).toEqual({ id: "as_1" });
    expect(prisma.automationSetting.findUnique).toHaveBeenCalledWith({
      where: {
        businessId_type: { businessId: BUSINESS_A, type: "review_request" },
      },
    });
  });
});

describe("getReviewRequestStatsThisMonth", () => {
  it("counts bookings with review request sent this month scoped by business", async () => {
    prisma.booking.count.mockResolvedValue(2);
    const res = await getReviewRequestStatsThisMonth(tenant);
    expect(res).toEqual({ sentThisMonth: 2 });
    const arg = prisma.booking.count.mock.calls[0][0] as {
      where: { businessId: string; reviewRequestSentAt: { gte: Date } };
    };
    expect(arg.where.businessId).toBe(BUSINESS_A);
    expect(arg.where.reviewRequestSentAt.gte.getDate()).toBe(1);
  });
});

describe("getLastReviewRequestRun", () => {
  it("returns the latest run scoped + ordered desc", async () => {
    prisma.automationRun.findFirst.mockResolvedValue({ id: "run_1" });
    const res = await getLastReviewRequestRun(tenant);
    expect(res).toEqual({ id: "run_1" });
    expect(prisma.automationRun.findFirst).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_A, type: "review_request" },
      orderBy: { startedAt: "desc" },
    });
  });
});
