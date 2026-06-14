import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeBusiness, makeClient, BUSINESS_A } from "../helpers/factories";
import { Prisma } from "@prisma/client";

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

const requireCurrentBusiness = vi.fn();
const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: () => requireCurrentBusiness(),
  getCurrentUser: () => getCurrentUser(),
}));

import {
  runWinBackManualAction,
  checkWinBackEligibilityAction,
} from "@/server/win-back-automation/manual-run-action";

function enabledSetting(overrides: Record<string, unknown> = {}) {
  return {
    businessId: BUSINESS_A,
    type: "win_back",
    enabled: true,
    thresholdDays: 45,
    cooldownDays: 30,
    requireOptIn: true,
    offerType: "none",
    offerValue: null,
    messageTemplate: null,
    templateName: null,
    templateLanguage: "he",
    ...overrides,
  };
}

function eligibleClientRow(overrides: Record<string, unknown> = {}) {
  const client = makeClient(overrides);
  return {
    ...client,
    bookings: [
      {
        id: "bkg_old",
        status: "completed",
        startTime: new Date("2026-01-01T09:00:00Z"),
        priceSnapshot: new Prisma.Decimal(200),
        service: { name: "מניקור" },
      },
    ],
  };
}

let fetchSpy: ReturnType<typeof vi.fn> | undefined;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue(makeBusiness({ id: BUSINESS_A }));
  getCurrentUser.mockReset().mockResolvedValue({ id: "u1", isAdmin: false });
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runWinBackManualAction", () => {
  it("runs in mock mode (real send not configured) and reports per-client results without real sends", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
      id: "m1",
      ...a.data,
    }));
    prisma.automationMessage.update.mockResolvedValue({ id: "m1" });
    prisma.client.findMany.mockResolvedValue([
      eligibleClientRow({ id: "cli_1", fullName: "דנה", normalizedPhone: "+972501234567" }),
    ]);
    // per-client report fetch after the run
    prisma.automationMessage.findMany.mockResolvedValue([
      {
        phone: "+972501234567",
        status: "skipped",
        failureReason: "מצב פיתוח — הודעה לא נשלחה בפועל",
        client: { id: "cli_1", fullName: "דנה" },
      },
    ]);

    const result = await runWinBackManualAction();

    expect(result.success).toBe(true);
    expect(result.isMockMode).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].clientName).toBe("דנה");
    expect(result.messages[0].maskedPhone).toBe("****4567");
    expect(result.messages[0].status).toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a failure shape (not a throw) when the run reports an error", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ enabled: false }));
    const result = await runWinBackManualAction();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.messages).toEqual([]);
  });

  it("drops ignoreCooldown for non-admin users", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", isAdmin: false });
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.client.findMany.mockResolvedValue([]);
    prisma.automationMessage.findMany.mockResolvedValue([]);

    await runWinBackManualAction({ ignoreCooldown: true });

    // Non-admin → ignoreCooldown not applied → cooldown filter present
    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.automationMessages).toBeDefined();
  });

  it("applies ignoreCooldown for admin users", async () => {
    getCurrentUser.mockResolvedValue({ id: "admin", isAdmin: true });
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.client.findMany.mockResolvedValue([]);
    prisma.automationMessage.findMany.mockResolvedValue([]);

    await runWinBackManualAction({ ignoreCooldown: true });

    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.automationMessages).toBeUndefined();
  });
});

describe("checkWinBackEligibilityAction (dry-run, no sends)", () => {
  it("returns a not-configured shape when no setting exists", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    const result = await checkWinBackEligibilityAction();
    expect(result.success).toBe(true);
    expect(result.automationEnabled).toBe(false);
    expect(result.breakdown).toBeNull();
    expect(result.eligibleClients).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("computes breakdown + masked eligible clients and never sends", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.client.count.mockResolvedValue(0);
    prisma.client.findMany.mockImplementation(async (arg: { select?: unknown }) => {
      // blocked-clients uses `select`; eligibility uses `include`
      if (arg.select) return [];
      return [eligibleClientRow({ id: "cli_1", fullName: "דנה", normalizedPhone: "+972501234567" })];
    });

    const result = await checkWinBackEligibilityAction();
    expect(result.success).toBe(true);
    expect(result.breakdown).not.toBeNull();
    expect(result.eligibleClients[0]).toMatchObject({
      name: "דנה",
      maskedPhone: "****4567",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
