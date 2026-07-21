import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

// checkEnv is exercised only on the authorized path; keep it deterministic.
vi.mock("@/lib/env", () => ({
  checkEnv: () => ({ errors: [], warnings: ["w1"] }),
}));

import { GET } from "@/app/api/health/route";

function req(auth?: string): NextRequest {
  return new NextRequest("http://localhost/api/health", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => resetPrismaMock(prisma));

describe("GET /api/health", () => {
  it("returns 200 + ok when the DB responds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ database: "ok" });
    expect(typeof body.time).toBe("string");
    // No CRON_SECRET / no auth → no config block leaked.
    expect(body.config).toBeUndefined();
  });

  it("returns 503 + degraded when the DB query throws", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("down"));

    const res = await GET(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks).toEqual({ database: "fail" });
  });

  it("does NOT expose config when CRON_SECRET is unset even with a Bearer header", async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    delete process.env.CRON_SECRET;

    const res = await GET(req("Bearer anything"));
    const body = await res.json();
    expect(body.config).toBeUndefined();
  });

  it("does NOT expose config when the Bearer token is wrong", async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    vi.stubEnv("CRON_SECRET", "right-secret");

    const res = await GET(req("Bearer wrong-secret"));
    const body = await res.json();
    expect(body.config).toBeUndefined();
  });

  it("exposes the config + env block (booleans only) when authorized", async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    vi.stubEnv("CRON_SECRET", "right-secret");
    vi.stubEnv("ENABLE_REAL_WHATSAPP_SEND", "true");
    vi.stubEnv("WHATSAPP_TEST_MODE", "FALSE");
    vi.stubEnv("SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("MAKE_GROW_CREATE_LINK_WEBHOOK_URL", "https://hook.make.com/abc");
    vi.stubEnv("META_WEBHOOK_APP_SECRET", "secret-value");

    const res = await GET(req("Bearer right-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
    expect(body.config.realWhatsAppSend).toBe(true);
    expect(body.config.whatsAppTestMode).toBe(false);
    expect(body.config.subscriptionsEnabled).toBe(true);
    expect(body.config.growCreateLinkWebhookSet).toBe(true);
    expect(body.config.webhookAppSecretSet).toBe(true);
    expect(body.config.whatsAppEncryptionKeySet).toBe(false);
    expect(body.env).toEqual({ errors: [], warnings: ["w1"] });
  });

  it("reports the Grow/Make webhook as unset when missing", async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    vi.stubEnv("CRON_SECRET", "right-secret");

    const res = await GET(req("Bearer right-secret"));
    const body = await res.json();
    expect(body.config.growCreateLinkWebhookSet).toBe(false);
  });
});
