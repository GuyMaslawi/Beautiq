import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

const getCurrentUser = vi.fn();
const getCurrentBusiness = vi.fn();
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: () => getCurrentUser(),
  getCurrentBusiness: () => getCurrentBusiness(),
}));

// Runners — mocked so NO real WhatsApp send can occur.
const runWinBack = vi.fn();
const runMorning = vi.fn();
const runReview = vi.fn();
const sendReviewDemo = vi.fn();
vi.mock("@/server/win-back-automation/runner", () => ({
  runWinBackForBusiness: (...a: unknown[]) => runWinBack(...a),
}));
vi.mock("@/server/morning-reminder/runner", () => ({
  runMorningReminderForBusiness: (...a: unknown[]) => runMorning(...a),
}));
vi.mock("@/server/review-request/runner", () => ({
  runReviewRequestForBusiness: (...a: unknown[]) => runReview(...a),
}));
vi.mock("@/server/whatsapp/review-demo", () => ({
  sendReviewDemoTestMessage: (...a: unknown[]) => sendReviewDemo(...a),
}));

import { POST as runNowPOST } from "@/app/api/admin/automation/run-now/route";
import { POST as reminderPOST } from "@/app/api/admin/automation/reminder-now/route";
import { POST as reviewPOST } from "@/app/api/admin/automation/review-now/route";
import { POST as reviewTestPOST } from "@/app/api/admin/whatsapp/review-test-send/route";

function req(body?: unknown): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetPrismaMock(prisma);
  getCurrentUser.mockReset();
  getCurrentBusiness.mockReset();
  runWinBack.mockReset();
  runMorning.mockReset();
  runReview.mockReset();
  sendReviewDemo.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const WIN_RESULT = {
  success: true,
  sentCount: 2,
  failedCount: 0,
  skippedCount: 1,
  mockSkipCount: 1,
  runId: "run1",
};
const REMINDER_RESULT = { success: true, sentCount: 1, failedCount: 0, skippedCount: 0, runId: "r" };

describe("POST /api/admin/automation/run-now (win-back)", () => {
  it("403 for non-admins, runner never called", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    const res = await runNowPOST(req({}));
    expect(res.status).toBe(403);
    expect(runWinBack).not.toHaveBeenCalled();
  });

  it("404 when a specific businessId does not exist", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await runNowPOST(req({ businessId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("runs a single business and aggregates totals (skipped = skipped + mock)", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue({ id: "b1", name: "ביז", slug: "biz" });
    runWinBack.mockResolvedValue(WIN_RESULT);

    const res = await runNowPOST(req({ businessId: "b1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.totalSent).toBe(2);
    expect(body.totalSkipped).toBe(2); // skippedCount(1) + mockSkipCount(1)
    expect(body.totalMock).toBe(1);
    expect(runWinBack).toHaveBeenCalledTimes(1);
  });

  it("runs ALL enabled businesses when no body is given", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findMany.mockResolvedValue([{ businessId: "b1" }]);
    prisma.business.findMany.mockResolvedValue([{ id: "b1", name: "ביז", slug: "biz" }]);
    runWinBack.mockResolvedValue(WIN_RESULT);

    const res = await runNowPOST(req());
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(prisma.automationSetting.findMany).toHaveBeenCalledWith({
      where: { type: "win_back", enabled: true },
      select: { businessId: true },
    });
  });

  it("captures a per-business error without aborting the whole run", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue({ id: "b1", name: "ביז", slug: "biz" });
    runWinBack.mockRejectedValue(new Error("boom"));

    const res = await runNowPOST(req({ businessId: "b1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("boom");
  });
});

describe("POST /api/admin/automation/reminder-now", () => {
  it("403 for non-admins", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    expect((await reminderPOST(req({}))).status).toBe(403);
    expect(runMorning).not.toHaveBeenCalled();
  });

  it("uses a default setting when the business has none configured", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    runMorning.mockResolvedValue(REMINDER_RESULT);

    const res = await reminderPOST(req({ businessId: "b1" }));
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.totalSent).toBe(1);
    expect(runMorning).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "b1", bypassHourCheck: true }),
    );
  });

  it("runs all enabled businesses with no body", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findMany.mockResolvedValue([
      { businessId: "b1", sendHour: 9, thresholdDays: 0, messageTemplate: null, requireOptIn: false, templateName: null, templateLanguage: null },
    ]);
    runMorning.mockResolvedValue(REMINDER_RESULT);
    const res = await reminderPOST(req());
    expect((await res.json()).processed).toBe(1);
  });

  it("records an error result on runner failure", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findUnique.mockResolvedValue({
      businessId: "b1", sendHour: 9, thresholdDays: 0, messageTemplate: null, requireOptIn: false, templateName: null, templateLanguage: null,
    });
    runMorning.mockRejectedValue(new Error("x"));
    const res = await reminderPOST(req({ businessId: "b1" }));
    expect((await res.json()).results[0].success).toBe(false);
  });
});

describe("POST /api/admin/automation/review-now", () => {
  it("403 for non-admins", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    expect((await reviewPOST(req({}))).status).toBe(403);
  });

  it("falls back to default review settings and bypasses timing", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    runReview.mockResolvedValue({ success: true, sentCount: 3, failedCount: 0, skippedCount: 0 });
    const res = await reviewPOST(req({ businessId: "b1" }));
    const body = await res.json();
    expect(body.totalSent).toBe(3);
    expect(runReview).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "b1", bypassTiming: true }),
    );
  });

  it("runs all enabled and handles runner errors", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.automationSetting.findMany.mockResolvedValue([
      { businessId: "b1", offerValue: null, messageTemplate: null, sendHour: 10, requireOptIn: false, templateName: null, templateLanguage: null },
    ]);
    runReview.mockRejectedValue(new Error("nope"));
    const res = await reviewPOST(req());
    expect((await res.json()).results[0].success).toBe(false);
  });
});

describe("POST /api/admin/whatsapp/review-test-send", () => {
  it("403 for non-admins", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    expect((await reviewTestPOST(req({}))).status).toBe(403);
    expect(sendReviewDemo).not.toHaveBeenCalled();
  });

  it("404 when the targeted business does not exist", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await reviewTestPOST(req({ businessId: "ghost" }));
    expect(res.status).toBe(404);
  });

  it("400 when no businessId and admin has no current business", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    getCurrentBusiness.mockResolvedValue(null);
    const res = await reviewTestPOST(req({}));
    expect(res.status).toBe(400);
  });

  it("200 with result for a successful (non-blocked) send", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    getCurrentBusiness.mockResolvedValue({ id: "b1" });
    sendReviewDemo.mockResolvedValue({ blocked: false, sent: true });
    const res = await reviewTestPOST(req({}));
    expect(res.status).toBe(200);
    expect((await res.json()).sent).toBe(true);
    expect(sendReviewDemo).toHaveBeenCalledWith("b1");
  });

  it("409 when the send is blocked by a guard", async () => {
    getCurrentUser.mockResolvedValue({ id: "a", isAdmin: true });
    prisma.business.findUnique.mockResolvedValue({ id: "b1" });
    sendReviewDemo.mockResolvedValue({ blocked: true, reason: "test-mode-off" });
    const res = await reviewTestPOST(req({ businessId: "b1" }));
    expect(res.status).toBe(409);
  });
});
