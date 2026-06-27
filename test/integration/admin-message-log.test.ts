import { describe, it, expect, vi, beforeEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin WhatsApp message log (server/admin/message-log.ts).
 *
 * Verifies that:
 *   - structured Meta error fields are surfaced safely (no token),
 *   - the confirmation-gate block is classified as its own outcome
 *     (awaiting_confirmation) and NOT mistaken for a Meta/provider error,
 *   - phones are masked and queries are scoped by businessId.
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
import { getAdminMessageLog } from "@/server/admin/message-log";
import { NUMBER_NOT_CONFIRMED_REASON } from "@/lib/whatsapp/provider";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    createdAt: new Date("2026-06-27T09:00:00Z"),
    type: "booking_confirmation",
    source: "public_booking",
    status: "failed",
    failureReason: "fail",
    phone: "972501234567",
    templateId: null,
    templateLanguage: null,
    phoneNumberId: null,
    providerMessageId: null,
    retryCount: 0,
    errorCode: null,
    errorSubcode: null,
    errorType: null,
    errorFbtraceId: null,
    errorRaw: null,
    client: { fullName: "דנה" },
    ...over,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
});

describe("getAdminMessageLog", () => {
  it("scopes the query to the businessId", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([]);
    await getAdminMessageLog(BUSINESS_A);
    const arg = prisma.automationMessage.findMany.mock.calls.at(-1)?.[0];
    expect(arg.where).toEqual({ businessId: BUSINESS_A });
  });

  it("surfaces structured Meta error fields and masks the phone", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      row({
        failureReason: "Recipient not allowed [code 131030]",
        phoneNumberId: "1170382949488802",
        templateId: "booking_confirmation_he",
        templateLanguage: "he",
        errorCode: 131030,
        errorSubcode: 2655007,
        errorType: "OAuthException",
        errorFbtraceId: "AfbTrace999",
        errorRaw: '{"code":131030,"fbtrace_id":"AfbTrace999"}',
      }),
    ]);

    const log = await getAdminMessageLog(BUSINESS_A);
    const entry = log.entries[0];
    expect(entry.outcome).toBe("failed");
    expect(entry.maskedPhone).toBe("972***567");
    expect(entry.phoneNumberId).toBe("1170382949488802");
    expect(entry.templateLanguage).toBe("he");
    expect(entry.metaError).not.toBeNull();
    expect(entry.metaError?.code).toBe(131030);
    expect(entry.metaError?.subcode).toBe(2655007);
    expect(entry.metaError?.type).toBe("OAuthException");
    expect(entry.metaError?.fbtraceId).toBe("AfbTrace999");
    // No credential ever appears in the surfaced raw.
    expect(JSON.stringify(entry)).not.toMatch(/Bearer|EAA[A-Za-z0-9]/);
  });

  it("classifies the confirmation-gate block as awaiting_confirmation (not a provider error)", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([
      row({ status: "failed", failureReason: NUMBER_NOT_CONFIRMED_REASON }),
    ]);
    const log = await getAdminMessageLog(BUSINESS_A);
    expect(log.entries[0].outcome).toBe("awaiting_confirmation");
    expect(log.summary.awaiting_confirmation).toBe(1);
    expect(log.summary.failed).toBe(0);
    // A pre-Meta block carries no structured Meta error.
    expect(log.entries[0].metaError).toBeNull();
  });

  it("leaves metaError null when there are no structured error fields", async () => {
    prisma.automationMessage.findMany.mockResolvedValue([row()]);
    const log = await getAdminMessageLog(BUSINESS_A);
    expect(log.entries[0].metaError).toBeNull();
  });
});
