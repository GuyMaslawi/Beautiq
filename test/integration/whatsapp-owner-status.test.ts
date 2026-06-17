import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A, makeWhatsAppConnection } from "../helpers/factories";

/**
 * owner-status aggregates connection readiness with per-automation template
 * status into owner-friendly Hebrew. The owner must NEVER see template names,
 * tokens, WABA ids, or phone number ids in the ownerLabel.
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
import { getOwnerWhatsAppStatus } from "@/server/whatsapp/owner-status";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";

const ENCRYPTION_KEY = "a".repeat(64);

beforeEach(() => {
  resetPrismaMock(prisma);
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const OWNER_LABELS = new Set([
  "מוכן לשליחה",
  "ממתין לאישור WhatsApp",
  "מכינים תבניות הודעה",
  "נדחתה — פני לתמיכה",
  "WhatsApp לא מחובר",
]);

describe("getOwnerWhatsAppStatus", () => {
  it("all automations show 'WhatsApp לא מחובר' when connection is not active", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationSetting.findMany.mockResolvedValue([]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.anyReady).toBe(false);
    expect(status.automations.every((a) => a.ownerLabel === "WhatsApp לא מחובר")).toBe(true);
  });

  it("connected but no templates -> 'מכינים תבניות הודעה', not ready", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue([]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.automations.every((a) => a.ownerLabel === "מכינים תבניות הודעה")).toBe(true);
    expect(status.anyReady).toBe(false);
  });

  it("approved template -> 'מוכן לשליחה' and ready=true; owner labels are always safe", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    const tpl = DEFAULT_TEMPLATES[0];
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: tpl.automationType, templateName: tpl.name, templateStatus: "approved" },
    ]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    const ready = status.automations.find((a) => a.type === tpl.automationType);
    expect(ready?.ownerLabel).toBe("מוכן לשליחה");
    expect(ready?.ready).toBe(true);
    expect(status.anyReady).toBe(true);

    // No ownerLabel ever exposes a technical template name.
    for (const a of status.automations) {
      expect(OWNER_LABELS.has(a.ownerLabel)).toBe(true);
      expect(a.ownerLabel).not.toContain(tpl.name);
    }
  });

  it("rejected template -> 'נדחתה — פני לתמיכה'", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    const tpl = DEFAULT_TEMPLATES[0];
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: tpl.automationType, templateName: tpl.name, templateStatus: "rejected" },
    ]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    const rejected = status.automations.find((a) => a.type === tpl.automationType);
    expect(rejected?.ownerLabel).toBe("נדחתה — פני לתמיכה");
    expect(rejected?.ready).toBe(false);
  });

  it("splits automations into operational and marketing groups", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue([]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    // Operational = booking confirmation, reminder, review; marketing = win-back only.
    expect(status.operational.every((a) => a.group === "operational")).toBe(true);
    expect(status.marketing.every((a) => a.group === "marketing")).toBe(true);
    expect(status.marketing.map((a) => a.type)).toEqual(["win_back"]);
    expect(status.operational.length).toBe(DEFAULT_TEMPLATES.length - 1);
  });

  it("operational readiness is independent of a failed marketing template", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    // Every operational template is pending; the marketing win-back was rejected.
    prisma.automationSetting.findMany.mockResolvedValue(
      DEFAULT_TEMPLATES.map((t) => ({
        type: t.automationType,
        templateName: t.name,
        templateStatus: t.group === "marketing" ? "rejected" : "pending",
      })),
    );

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    // Core operational setup is ready (all submitted) even though marketing failed.
    expect(status.operationalReady).toBe(true);
    expect(status.marketingFailed).toBe(true);
    expect(status.marketingReady).toBe(false);
    const winBack = status.marketing.find((a) => a.type === "win_back");
    expect(winBack?.failed).toBe(true);
    expect(winBack?.ownerLabel).toBe("נדחתה — פני לתמיכה");
  });

  it("readiness levels: approved operational templates -> ready + canSendOperationalMessages", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue(
      DEFAULT_TEMPLATES.map((t) => ({
        type: t.automationType,
        templateName: t.name,
        templateStatus: "approved",
      })),
    );

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.ownerSetupState).toBe("ready");
    expect(status.ownerSetupLabel).toBe("WhatsApp מוכן לשליחה");
    expect(status.readiness.connectionReady).toBe(true);
    expect(status.readiness.numberConfirmed).toBe(true);
    expect(status.readiness.operationalTemplatesReadyOrPending).toBe(true);
    expect(status.readiness.canSendOperationalMessages).toBe(true);
    expect(status.readiness.canSendMarketingMessages).toBe(true);
  });

  it("readiness levels: pending operational templates -> pending_approval, cannot send yet", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue(
      DEFAULT_TEMPLATES.map((t) => ({
        type: t.automationType,
        templateName: t.name,
        templateStatus: "pending",
      })),
    );

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.ownerSetupState).toBe("pending_approval");
    expect(status.ownerSetupLabel).toBe("ממתין לאישור WhatsApp");
    expect(status.readiness.operationalTemplatesReadyOrPending).toBe(true);
    expect(status.readiness.canSendOperationalMessages).toBe(false);
  });

  it("readiness levels: a rejected operational template -> needs_support", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue(
      DEFAULT_TEMPLATES.map((t, i) => ({
        type: t.automationType,
        templateName: t.name,
        // Reject the first operational template; the rest are pending.
        templateStatus: t.group === "operational" && i === 0 ? "rejected" : "pending",
      })),
    );

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.ownerSetupState).toBe("needs_support");
    expect(status.ownerSetupLabel).toBe("נדרשת בדיקה");
    expect(status.readiness.canSendOperationalMessages).toBe(false);
  });

  it("a marketing-only failure never pushes the owner setup state to needs_support", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({ status: "active", useEnvFallback: true }),
    );
    prisma.automationSetting.findMany.mockResolvedValue(
      DEFAULT_TEMPLATES.map((t) => ({
        type: t.automationType,
        templateName: t.name,
        templateStatus: t.group === "marketing" ? "rejected" : "approved",
      })),
    );

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    expect(status.ownerSetupState).toBe("ready");
    expect(status.marketingFailed).toBe(true);
    expect(status.readiness.canSendOperationalMessages).toBe(true);
  });

  it("connected but number not confirmed -> needs_confirmation, cannot send", async () => {
    prisma.whatsAppConnection.findUnique.mockResolvedValue(
      makeWhatsAppConnection({
        status: "active",
        useEnvFallback: true,
        numberConfirmedAt: null,
        connectionSource: "existing_business_app",
      }),
    );
    prisma.automationSetting.findMany.mockResolvedValue([]);

    const status = await getOwnerWhatsAppStatus(BUSINESS_A);
    // A guided-flow connection (connectionSource set, not yet confirmed) must
    // require number confirmation before anything can send.
    expect(status.connection.needsNumberConfirmation).toBe(true);
    expect(status.ownerSetupState).toBe("needs_confirmation");
    expect(status.readiness.numberConfirmed).toBe(false);
    expect(status.readiness.canSendOperationalMessages).toBe(false);
  });
});
