import { describe, it, expect, vi, beforeEach } from "vitest";
import type { createPrismaMock } from "../helpers/prisma-mock";

/**
 * Cross-instance rate limiting (src/server/rate-limit/persistent.ts).
 *
 * The in-memory limiter is per-process, so on serverless the real ceiling is
 * (limit × live instances) — it loosens exactly when an attacker pushes harder.
 * This limiter shares one counter across every instance. The two properties
 * worth locking down are the ones that are easy to get wrong:
 *
 *   1. an expired window resets via a CONDITIONAL update, so two concurrent
 *      requests cannot both "reset" it and slip past the cap;
 *   2. it fails OPEN, so a database blip never locks a business owner out of
 *      her own account.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prismaMock = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  captureError: vi.fn(),
}));

import {
  checkPersistentRateLimit,
  pruneRateLimitCounters,
} from "@/server/rate-limit/persistent";

beforeEach(() => {
  prismaMock.rateLimitCounter.updateMany.mockReset();
  prismaMock.rateLimitCounter.upsert.mockReset();
  prismaMock.rateLimitCounter.deleteMany.mockReset();
  prismaMock.rateLimitCounter.updateMany.mockResolvedValue({ count: 0 });
});

describe("checkPersistentRateLimit", () => {
  it("allows a request while the count is within the cap", async () => {
    prismaMock.rateLimitCounter.upsert.mockResolvedValue({ count: 3 });
    await expect(checkPersistentRateLimit("login:acct:a@b.com", 5, 60_000)).resolves.toBe(
      true,
    );
  });

  it("allows the request that lands exactly on the cap", async () => {
    prismaMock.rateLimitCounter.upsert.mockResolvedValue({ count: 5 });
    await expect(checkPersistentRateLimit("login:acct:a@b.com", 5, 60_000)).resolves.toBe(
      true,
    );
  });

  it("blocks once the count passes the cap", async () => {
    prismaMock.rateLimitCounter.upsert.mockResolvedValue({ count: 6 });
    await expect(checkPersistentRateLimit("login:acct:a@b.com", 5, 60_000)).resolves.toBe(
      false,
    );
  });

  it("resets an expired window with a conditional update, not read-then-write", async () => {
    prismaMock.rateLimitCounter.upsert.mockResolvedValue({ count: 1 });
    await checkPersistentRateLimit("wa:send:biz_1", 500, 86_400_000);

    const where = prismaMock.rateLimitCounter.updateMany.mock.calls[0][0].where;
    expect(where.key).toBe("wa:send:biz_1");
    // The `resetAt <= now` predicate is what makes the reset safe under
    // concurrency: a request arriving mid-window matches nothing and therefore
    // cannot zero a live counter.
    expect(where.resetAt).toHaveProperty("lte");
  });

  it("increments rather than overwriting, so parallel callers all count", async () => {
    prismaMock.rateLimitCounter.upsert.mockResolvedValue({ count: 2 });
    await checkPersistentRateLimit("signup:1.2.3.4", 8, 600_000);

    const args = prismaMock.rateLimitCounter.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ count: { increment: 1 } });
    expect(args.create.count).toBe(1);
  });

  it("fails OPEN when the database is unavailable", async () => {
    prismaMock.rateLimitCounter.updateMany.mockRejectedValue(new Error("no connection"));
    // Locking every owner out of the product during a DB blip would be a worse
    // outcome than briefly leaning on the in-memory limiter alone.
    await expect(checkPersistentRateLimit("login:acct:a@b.com", 5, 60_000)).resolves.toBe(
      true,
    );
  });
});

describe("pruneRateLimitCounters", () => {
  it("deletes only counters whose window ended long ago", async () => {
    prismaMock.rateLimitCounter.deleteMany.mockResolvedValue({ count: 12 });
    await expect(pruneRateLimitCounters()).resolves.toBe(12);

    const where = prismaMock.rateLimitCounter.deleteMany.mock.calls[0][0].where;
    expect(where.resetAt).toHaveProperty("lt");
  });

  it("never throws into the cron job", async () => {
    prismaMock.rateLimitCounter.deleteMany.mockRejectedValue(new Error("boom"));
    await expect(pruneRateLimitCounters()).resolves.toBe(0);
  });
});
