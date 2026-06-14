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
});
