import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * SECURITY-CRITICAL: every cron route triggers automated WhatsApp sends. They
 * MUST be unreachable without the correct CRON_SECRET (Authorization: Bearer).
 * These tests prove:
 *   - Missing/empty CRON_SECRET env -> always 401 (fail closed).
 *   - Missing/wrong Authorization header -> 401 and the runner is NEVER invoked.
 *   - Correct secret -> 200 and the runner runs (runner mocked, no real send).
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

// Mock the runners so NO real send can occur even if a guard were bypassed.
const runMorning = vi.fn(async () => ({ sentCount: 0, skippedCount: 0, failedCount: 0 }));
const runWinBack = vi.fn(async () => ({ success: true, sentCount: 0, failedCount: 0, skippedCount: 0 }));
const runReview = vi.fn(async () => ({ sentCount: 0, skippedCount: 0, failedCount: 0 }));

vi.mock("@/server/morning-reminder/runner", () => ({
  runMorningReminderForBusiness: (...a: unknown[]) => (runMorning as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("@/server/win-back-automation/runner", () => ({
  runWinBackForBusiness: (...a: unknown[]) => (runWinBack as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("@/server/review-request/runner", () => ({
  runReviewRequestForBusiness: (...a: unknown[]) => (runReview as (...x: unknown[]) => unknown)(...a),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { GET as morningGET } from "@/app/api/cron/morning-reminder/route";
import { GET as winBackGET } from "@/app/api/cron/win-back/route";
import { GET as reviewGET } from "@/app/api/cron/review-request/route";

const SECRET = "super-cron-secret";

function req(auth?: string): Request {
  return new Request("https://example.com/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });
}


beforeEach(() => {
  resetPrismaMock(prisma);
  // Empty result set so authorized runs do nothing real.
  prisma.automationSetting.findMany.mockResolvedValue([]);
  prisma.whatsAppConnection.findMany.mockResolvedValue([]);
  prisma.business.findMany.mockResolvedValue([]);
  runMorning.mockClear();
  runWinBack.mockClear();
  runReview.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ROUTES = [
  { name: "morning-reminder", handler: morningGET, runner: runMorning },
  { name: "win-back", handler: winBackGET, runner: runWinBack },
  { name: "review-request", handler: reviewGET, runner: runReview },
];

for (const route of ROUTES) {
  describe(`cron ${route.name} — auth guard`, () => {
    it("401 when CRON_SECRET env is not set (fail closed)", async () => {
      // No CRON_SECRET, valid-looking header — must still reject.
      const res = await route.handler(req(`Bearer anything`));
      expect(res.status).toBe(401);
      expect(route.runner).not.toHaveBeenCalled();
    });

    it("401 when Authorization header is missing", async () => {
      process.env.CRON_SECRET = SECRET;
      const res = await route.handler(req());
      expect(res.status).toBe(401);
      expect(route.runner).not.toHaveBeenCalled();
    });

    it("401 when the bearer secret is wrong", async () => {
      process.env.CRON_SECRET = SECRET;
      const res = await route.handler(req("Bearer wrong-secret"));
      expect(res.status).toBe(401);
      expect(route.runner).not.toHaveBeenCalled();
    });

    it("401 when scheme is correct but value is empty", async () => {
      process.env.CRON_SECRET = SECRET;
      const res = await route.handler(req("Bearer "));
      expect(res.status).toBe(401);
      expect(route.runner).not.toHaveBeenCalled();
    });

    it("200 with the correct bearer secret", async () => {
      process.env.CRON_SECRET = SECRET;
      const res = await route.handler(req(`Bearer ${SECRET}`));
      expect(res.status).toBe(200);
    });
  });
}
