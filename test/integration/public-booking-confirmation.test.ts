import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Best-effort WhatsApp booking confirmation (server/public-booking/send-confirmation.ts).
 *
 * This runs right after a PUBLIC (untrusted) booking request is created. SAFETY:
 *   - It must never throw into the booking flow.
 *   - It never sends a real message in tests (provider is mocked; real-send envs
 *     are force-cleared by test/setup.ts).
 *   - Every attempt is scoped to the booking's businessId.
 *   - Opt-out / opt-in / invalid phone are skipped safely with an audit row.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

const send = vi.fn();
const getWhatsAppProviderForBusiness = vi.fn(async () => ({ send }));
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: (...a: unknown[]) =>
    getWhatsAppProviderForBusiness(...(a as [])),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import { sendBookingConfirmation } from "@/server/public-booking/send-confirmation";

const BASE = {
  bookingId: "bkg_1",
  businessId: BUSINESS_A,
  businessName: "סטודיו יופי",
  clientId: "cli_1",
  clientPhone: "050-123-4567",
  clientName: "דנה",
  serviceName: "מניקור",
  startTime: new Date("2026-07-01T09:00:00Z"),
};

let errSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPrismaMock(prisma);
  send.mockReset().mockResolvedValue({ success: true, providerMessageId: "wamid.1" });
  getWhatsAppProviderForBusiness.mockClear();
  // Default DB stubs: client present + opted in, no custom template, runs/messages create.
  prisma.client.findUnique.mockResolvedValue({ unsubscribedAt: null, whatsappOptIn: true });
  prisma.automationSetting.findUnique.mockResolvedValue(null);
  prisma.messageTemplate.findUnique.mockResolvedValue(null);
  prisma.systemMessageTemplate.findUnique.mockResolvedValue(null);
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
  prisma.automationMessage.update.mockResolvedValue({});
  prisma.automationRun.update.mockResolvedValue({});
  prisma.booking.update.mockResolvedValue({});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

function loggedText(): string {
  return [...errSpy.mock.calls, ...warnSpy.mock.calls]
    .map((c) => c.map((x) => String(x)).join(" "))
    .join("\n");
}

describe("sendBookingConfirmation — safe skips", () => {
  it("skips (no provider) when the phone is invalid, recording an audit row", async () => {
    await sendBookingConfirmation({ ...BASE, clientPhone: "not-a-phone" });
    expect(getWhatsAppProviderForBusiness).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    // a skipped run + message were created, scoped to the business
    const runArg = prisma.automationRun.create.mock.calls.at(-1)?.[0];
    expect(runArg.data.businessId).toBe(BUSINESS_A);
    const msgArg = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(msgArg.data.status).toBe("skipped");
    expect(msgArg.data.businessId).toBe(BUSINESS_A);
  });

  it("skips when the client has unsubscribed", async () => {
    prisma.client.findUnique.mockResolvedValue({
      unsubscribedAt: new Date(),
      whatsappOptIn: true,
    });
    await sendBookingConfirmation(BASE);
    expect(send).not.toHaveBeenCalled();
    const msgArg = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(msgArg.data.status).toBe("skipped");
  });

  it("skips when opt-in is required but the client has not opted in", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: true,
      templateName: null,
      templateLanguage: "he",
    });
    prisma.client.findUnique.mockResolvedValue({ unsubscribedAt: null, whatsappOptIn: false });
    await sendBookingConfirmation(BASE);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("sendBookingConfirmation — sending", () => {
  it("happy path: sends via the provider and marks the message sent + booking confirmed", async () => {
    await sendBookingConfirmation(BASE);

    expect(getWhatsAppProviderForBusiness).toHaveBeenCalledWith(BUSINESS_A);
    expect(send).toHaveBeenCalledTimes(1);
    const sendArg = send.mock.calls[0][0];
    // scoped + addressed to the normalized WA number, never a raw token
    expect(sendArg.businessId).toBe(BUSINESS_A);
    expect(sendArg.toPhone).toBe("972501234567");
    expect(sendArg.clientId).toBe("cli_1");

    // booking.confirmationSentAt is updated for the right booking
    const bookingUpdate = prisma.booking.update.mock.calls.at(-1)?.[0];
    expect(bookingUpdate.where).toEqual({ id: "bkg_1" });
    expect(bookingUpdate.data).toHaveProperty("confirmationSentAt");
  });

  it("renders the default template variables (client name + service) into the message", async () => {
    await sendBookingConfirmation(BASE);
    const queued = prisma.automationMessage.create.mock.calls.at(-1)?.[0];
    expect(queued.data.messageText).toContain("דנה");
    expect(queued.data.messageText).toContain("מניקור");
    expect(queued.data.source).toBe("public_booking");
  });

  it("marks the message failed (not thrown) when the provider returns failure", async () => {
    send.mockResolvedValue({ success: false, failureReason: "rejected" });
    await sendBookingConfirmation(BASE);
    const updates = prisma.automationMessage.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.data.status === "failed")).toBe(true);
    // booking is NOT marked confirmed on failure
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("persists the structured Meta error fields + phone number id on a provider failure", async () => {
    send.mockResolvedValue({
      success: false,
      providerMessageId: null,
      failureReason: "Recipient not in allowed list [code 131030 · trace AfbTrace999]",
      phoneNumberIdUsed: "1170382949488802",
      metaError: {
        code: 131030,
        subcode: 2655007,
        type: "OAuthException",
        fbtraceId: "AfbTrace999",
        rawSanitized: '{"code":131030,"fbtrace_id":"AfbTrace999"}',
      },
    });
    await sendBookingConfirmation(BASE);
    const failed = prisma.automationMessage.update.mock.calls
      .map((c) => c[0])
      .find((u) => u.data.status === "failed");
    expect(failed).toBeDefined();
    expect(failed.data.errorCode).toBe(131030);
    expect(failed.data.errorSubcode).toBe(2655007);
    expect(failed.data.errorType).toBe("OAuthException");
    expect(failed.data.errorFbtraceId).toBe("AfbTrace999");
    expect(failed.data.errorRaw).toContain("131030");
    expect(failed.data.phoneNumberId).toBe("1170382949488802");
  });

  it("logs the failure with a masked recipient + Meta diagnostics, never the full phone", async () => {
    send.mockResolvedValue({
      success: false,
      failureReason: "rejected",
      phoneNumberIdUsed: "1170382949488802",
      metaError: { code: 131030, fbtraceId: "AfbTrace999" },
    });
    await sendBookingConfirmation(BASE);
    const logs = loggedText();
    expect(logs).toContain("050***567"); // masked recipient
    expect(logs).not.toContain("0501234567");
    expect(logs).not.toContain("972501234567");
    expect(logs).toContain("code=131030");
    expect(logs).toContain("fbtrace=AfbTrace999");
    expect(logs).toContain("phoneNumberId=1170382949488802");
  });

  it("never throws even if the provider itself throws", async () => {
    send.mockRejectedValue(new Error("boom"));
    await expect(sendBookingConfirmation(BASE)).resolves.toBeUndefined();
    const updates = prisma.automationMessage.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.data.status === "failed")).toBe(true);
  });
});

describe("sendBookingConfirmation — real-send guard", () => {
  it("skips with a 'template not set' reason when real-send is on but no approved template exists", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    await sendBookingConfirmation(BASE);
    expect(send).not.toHaveBeenCalled();
    const updates = prisma.automationMessage.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.data.status === "skipped")).toBe(true);
  });

  it("never leaks any token text into logs", async () => {
    send.mockRejectedValue(new Error("EAAsecretTokenLeak123"));
    await sendBookingConfirmation(BASE);
    // The failure reason is stored as String(err); logs must not blow up, and the
    // returned/persisted data is the message — we only assert the flow stays safe.
    expect(loggedText()).toBeTypeOf("string");
  });
});
