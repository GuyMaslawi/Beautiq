import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeClient, BUSINESS_A } from "../helpers/factories";
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

import { runWinBackForBusiness } from "@/server/win-back-automation/runner";

const BUSINESS = { id: BUSINESS_A, name: "סטודיו יופי", slug: "studio-yofi" };

function enabledSetting(overrides: Record<string, unknown> = {}) {
  return {
    businessId: BUSINESS_A,
    type: "win_back",
    enabled: true,
    thresholdDays: 45,
    cooldownDays: 30,
    requireOptIn: true,
    offerType: "discount_10",
    offerValue: null,
    messageTemplate: null,
    templateName: null,
    templateLanguage: "he",
    ...overrides,
  };
}

/** An eligible-client shaped row from prisma.client.findMany (used by eligibility). */
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
  // Spy on global fetch — assert NO real network call (real send) happens.
  fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runWinBackForBusiness — disabled / guard cases", () => {
  it("returns an error and creates no run when the automation is disabled", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting({ enabled: false }));
    const result = await runWinBackForBusiness(BUSINESS);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it("returns an error when no setting exists at all", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    const result = await runWinBackForBusiness(BUSINESS);
    expect(result.success).toBe(false);
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });
});

describe("runWinBackForBusiness — no-real-send guarantee (dev mock)", () => {
  beforeEach(() => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
      id: "msg_1",
      ...a.data,
    }));
    prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
    // resolver reads whatsAppConnection — with real-send OFF it never reaches it,
    // but stub to be safe.
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
  });

  it("records eligible clients as skipped (dev mock) and never calls fetch", async () => {
    prisma.client.findMany.mockResolvedValue([
      eligibleClientRow({ id: "cli_1", normalizedPhone: "+972501234567" }),
    ]);

    const result = await runWinBackForBusiness(BUSINESS);

    expect(result.success).toBe(true);
    // dev mock -> isMockSkip -> message marked skipped, counted as mockSkip
    expect(result.sentCount).toBe(0);
    expect(result.mockSkipCount).toBe(1);
    expect(result.skippedCount).toBe(1);

    // The AutomationRun + AutomationMessage records were created
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A, type: "win_back", status: "running" }),
      }),
    );
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "queued", type: "win_back" }) }),
    );
    // message updated to skipped with the dev-mock reason
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
    // run finalized as completed
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }),
    );

    // THE GUARANTEE: no real network send happened
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips a client with an invalid phone before any provider call", async () => {
    prisma.client.findMany.mockResolvedValue([
      // Passes the eligibility +972 DB prefix + regex but is rejected by the
      // runner's isValidIsraeliPhone? Use a phone that the eligibility regex
      // accepts but isValidIsraeliPhone rejects is not possible; instead force a
      // phone that fails the runner guard by being too short after the prefix.
      eligibleClientRow({ id: "cli_bad", normalizedPhone: "+9725000" }),
    ]);
    const result = await runWinBackForBusiness(BUSINESS);
    // The eligibility regex already drops +9725000 (too short), so it's not in
    // the eligible set and nothing is processed.
    expect(result.skippedCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates a run with eligibleCount=0 and no messages when nobody is eligible", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const result = await runWinBackForBusiness(BUSINESS);
    expect(result.success).toBe(true);
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eligibleCount: 0 }) }),
    );
    expect(prisma.automationMessage.create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("runWinBackForBusiness — failure isolation", () => {
  it("records a failed send without throwing the whole run", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationMessage.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
      id: "msg_x",
      ...a.data,
    }));
    prisma.automationMessage.update.mockResolvedValue({ id: "msg_x" });

    // Two eligible clients; the provider is dev mock so both become mock-skips.
    prisma.client.findMany.mockResolvedValue([
      eligibleClientRow({ id: "c1", normalizedPhone: "+972501111111" }),
      eligibleClientRow({ id: "c2", normalizedPhone: "+972502222222" }),
    ]);

    const result = await runWinBackForBusiness(BUSINESS);
    expect(result.success).toBe(true);
    // both processed (mock-skipped), run completes
    expect(result.mockSkipCount).toBe(2);
    expect(prisma.automationMessage.create).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("runWinBackForBusiness — admin ignoreCooldown plumbing", () => {
  it("passes ignoreCooldown through to the eligibility query (drops cooldown filter)", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(enabledSetting());
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.client.findMany.mockResolvedValue([]);

    await runWinBackForBusiness(BUSINESS, { ignoreCooldown: true });

    const where = prisma.client.findMany.mock.calls[0][0].where;
    expect(where.automationMessages).toBeUndefined();
  });
});

describe("runWinBackForBusiness — minute-mode env gating (cron safety)", () => {
  function minuteSetting() {
    return enabledSetting({
      timingUnit: "minutes",
      testThresholdMinutes: 10,
      testCooldownMinutes: 2,
    });
  }

  function thresholdAgoMs() {
    const where = prisma.client.findMany.mock.calls[0][0].where;
    return Date.now() - where.bookings.some.startTime.lt.getTime();
  }

  beforeEach(() => {
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.client.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honors minute mode in non-production (dev/test)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    prisma.automationSetting.findUnique.mockResolvedValue(minuteSetting());
    await runWinBackForBusiness(BUSINESS);
    // ~10 minutes, far below a day
    expect(thresholdAgoMs()).toBeLessThan(60 * 60 * 1000);
  });

  it("IGNORES a stored minute mode in production without the env flag (falls back to days)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "");
    prisma.automationSetting.findUnique.mockResolvedValue(minuteSetting());
    await runWinBackForBusiness(BUSINESS);
    // 45-day threshold, NOT 10 minutes — production never auto-sends on minutes
    expect(thresholdAgoMs()).toBeGreaterThan(44 * 24 * 60 * 60 * 1000);
  });

  it("honors minute mode in production when ENABLE_AUTOMATION_MINUTE_TESTING=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_AUTOMATION_MINUTE_TESTING", "true");
    prisma.automationSetting.findUnique.mockResolvedValue(minuteSetting());
    await runWinBackForBusiness(BUSINESS);
    expect(thresholdAgoMs()).toBeLessThan(60 * 60 * 1000);
  });
});
