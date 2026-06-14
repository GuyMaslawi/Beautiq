import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>).__prismaMock as ReturnType<
  typeof createPrismaMock
>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireTenant = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireTenant: () => requireTenant(),
}));

import { retryAutomationMessageAction } from "@/server/automations/retry-action";

function failedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    runId: "run_1",
    clientId: "cli_1",
    phone: "+972501234567",
    templateId: null,
    messageText: "היי",
    status: "failed",
    retryCount: 0,
    client: {
      id: "cli_1",
      businessId: BUSINESS_A,
      unsubscribedAt: null,
      normalizedPhone: "+972501234567",
    },
    ...overrides,
  };
}

let fetchSpy: ReturnType<typeof vi.fn> | undefined;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("retryAutomationMessageAction — guards", () => {
  it("scopes the message lookup to the tenant + failed status", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(null);
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(prisma.automationMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "msg_1",
          businessId: BUSINESS_A,
          status: "failed",
        }),
      }),
    );
  });

  it("rejects a cross-tenant client (defense in depth)", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(
      failedMessage({ client: { id: "cli", businessId: BUSINESS_B, unsubscribedAt: null, normalizedPhone: "+972501234567" } }),
    );
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("אבטחה");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to retry an unsubscribed client", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(
      failedMessage({ client: { id: "cli_1", businessId: BUSINESS_A, unsubscribedAt: new Date(), normalizedPhone: "+972501234567" } }),
    );
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses once the max retry count is reached", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage({ retryCount: 3 }));
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("המקסימלי");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an invalid phone", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(
      failedMessage({ client: { id: "cli_1", businessId: BUSINESS_A, unsubscribedAt: null, normalizedPhone: "+9725" } }),
    );
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("טלפון");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("retryAutomationMessageAction — dev mock provider (no real send)", () => {
  it("records a failed retry attempt with the dev-mock message and increments retryCount", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });

    const res = await retryAutomationMessageAction("msg_1");

    // dev mock returns isMockSkip -> success=false with dev-mode Hebrew message
    expect(res.success).toBe(false);
    expect(res.error).toContain("פיתוח");
    // attempt recorded with incremented retry
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ retryCount: { increment: 1 } }),
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
