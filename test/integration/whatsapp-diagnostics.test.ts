import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A, makeWhatsAppConnection, makeClient } from "../helpers/factories";

/**
 * The dry-run diagnostics engine must return the EXACT, stable reason a message
 * would be blocked — never a generic failure. These tests pin each block code.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

import { resetPrismaMock } from "../helpers/prisma-mock";
import { evaluateWhatsAppSend } from "@/server/whatsapp/diagnostics";

const REAL_TOKEN = "EAAsecret-token-xyz";

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPrismaMock(prisma);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

/** Make the resolver return the real Meta provider (active env-fallback connection). */
function enableRealConnection() {
  process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
  process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
  process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = "phone_123";
  prisma.whatsAppConnection.findUnique.mockResolvedValue(
    makeWhatsAppConnection({ status: "active", useEnvFallback: true, phoneNumberId: "phone_123" }),
  );
}

function approvedSetting(overrides: Record<string, unknown> = {}) {
  return {
    templateName: "tpl_confirmation",
    templateStatus: "approved",
    requireOptIn: false,
    cooldownDays: 30,
    ...overrides,
  };
}

describe("evaluateWhatsAppSend — block reasons", () => {
  it("real_send_disabled when ENABLE_REAL_WHATSAPP_SEND is off", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
    });
    expect(result.wouldSend).toBe(false);
    expect(result.blockReason?.code).toBe("real_send_disabled");
  });

  it("missing_template when real send is on but no approved template", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(
      approvedSetting({ templateName: null, templateStatus: null }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
    });
    expect(result.wouldSend).toBe(false);
    expect(result.blockReason?.code).toBe("missing_template");
  });

  it("template_not_approved when a template exists but is pending", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(
      approvedSetting({ templateStatus: "pending" }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
    });
    expect(result.blockReason?.code).toBe("template_not_approved");
  });

  it("invalid_phone when the selected client has no valid phone", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(makeClient({ phone: "123" }));
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(result.wouldSend).toBe(false);
    expect(result.blockReason?.code).toBe("invalid_phone");
  });

  it("unsubscribed when the client opted out", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(
      makeClient({ unsubscribedAt: new Date("2026-05-01T00:00:00Z") }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(result.blockReason?.code).toBe("unsubscribed");
  });

  it("test_mode_recipient_mismatch when test mode is on and client ≠ test phone", async () => {
    enableRealConnection();
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.WHATSAPP_TEST_PHONE = "+972544961155";
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(makeClient({ phone: "0501234567" }));
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(result.wouldSend).toBe(false);
    expect(result.blockReason?.code).toBe("test_mode_recipient_mismatch");
  });
});

describe("evaluateWhatsAppSend — opt-in policy (transactional vs marketing)", () => {
  it("win_back no longer requires a marketing opt-in (only a STOP opt-out blocks it)", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.automationMessage.findFirst.mockResolvedValue(null); // outside the cooldown window
    // Client never opted into marketing but never sent STOP → still eligible under the
    // neutral-template model (win-back gated by unsubscribedAt, not a marketing opt-in).
    prisma.client.findFirst.mockResolvedValue(
      makeClient({ whatsappOptIn: true, marketingOptIn: false, unsubscribedAt: null }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "win_back",
      clientId: "cli_1",
    });
    expect(result.wouldSend).toBe(true);
    expect(result.blockReason).toBeUndefined();
  });

  it("win_back IS blocked when the client sent STOP (unsubscribed)", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.automationMessage.findFirst.mockResolvedValue(null);
    prisma.client.findFirst.mockResolvedValue(
      makeClient({ unsubscribedAt: new Date("2026-05-01T00:00:00Z") }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "win_back",
      clientId: "cli_1",
    });
    expect(result.wouldSend).toBe(false);
    expect(result.blockReason?.code).toBe("unsubscribed");
  });

  it("booking_confirmation does NOT require marketing opt-in", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(
      makeClient({ whatsappOptIn: false, marketingOptIn: false }),
    );
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(result.wouldSend).toBe(true);
    expect(result.blockReason).toBeUndefined();
  });
});

describe("evaluateWhatsAppSend — happy path & safety", () => {
  it("wouldSend=true for a fully configured booking confirmation (no client)", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
    });
    expect(result.wouldSend).toBe(true);
  });

  it("never leaks the access token in the evaluation output", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(makeClient());
    const result = await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(JSON.stringify(result)).not.toContain(REAL_TOKEN);
  });

  it("scopes the client lookup by businessId (multi-tenant safety)", async () => {
    enableRealConnection();
    prisma.automationSetting.findUnique.mockResolvedValue(approvedSetting());
    prisma.client.findFirst.mockResolvedValue(makeClient());
    await evaluateWhatsAppSend({
      businessId: BUSINESS_A,
      messageType: "booking_confirmation",
      clientId: "cli_1",
    });
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "cli_1", businessId: BUSINESS_A }),
      }),
    );
  });
});
