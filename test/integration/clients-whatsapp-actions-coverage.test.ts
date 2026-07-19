import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, makeClient } from "../helpers/factories";

/**
 * Branch coverage for sendManualClientWhatsAppAction beyond the validation suite:
 * each message-type build path (win_back / appointment_reminder / review_request),
 * the real-send missing-template guard per type, the win_back whatsappOptIn guard,
 * the provider result branches (mock-skip / test-mode-block / success-with-test-mode),
 * and the test-mode recipient redirect.
 */

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

const requireCurrentBusiness = vi.fn(async () => ({ id: BUSINESS_A, name: "סטודיו יופי" }));
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: (...a: unknown[]) => (requireCurrentBusiness as (...x: unknown[]) => unknown)(...a),
}));

const send = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ name: "stub", send })),
}));

import { sendManualClientWhatsAppAction } from "@/server/clients/whatsapp-actions";

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    ...makeClient({
      id: "cli_1",
      businessId: BUSINESS_A,
      normalizedPhone: "+972501234567",
      whatsappOptIn: true,
      marketingOptIn: true,
      unsubscribedAt: null,
    }),
    bookings: [{ id: "b1", service: { name: "מניקור" } }],
    ...overrides,
  };
}

function primeSendableState() {
  prisma.client.findUnique.mockResolvedValue(clientRow());
  prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
  prisma.automationMessage.count.mockResolvedValue(0);
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
  prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
  prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue({ id: BUSINESS_A, name: "סטודיו יופי" });
  send.mockReset().mockResolvedValue({ success: true, providerMessageId: "wamid.1" });
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  delete process.env.WHATSAPP_TEST_MODE;
  delete process.env.WHATSAPP_TEST_PHONE;
});

describe("sendManualClientWhatsAppAction — win_back opt-out guards", () => {
  it("blocks win_back when the client has unsubscribed (STOP opt-out)", async () => {
    // Consent is no longer gated per-message on whatsappOptIn/marketingOptIn — the only
    // client-level block is an explicit STOP (unsubscribedAt).
    prisma.client.findUnique.mockResolvedValue(clientRow({ unsubscribedAt: new Date() }));
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    const res = await sendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.error).toContain("לא מעוניינת");
    expect(send).not.toHaveBeenCalled();
  });

  it("errors on win_back when real send is on but no template is configured", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({ requireOptIn: false, offerType: "none", offerValue: null, messageTemplate: null, templateName: null });
    const res = await sendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.error).toContain("תבנית");
    expect(send).not.toHaveBeenCalled();
  });

  it("builds a win_back message with 2 template variables and sends", async () => {
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: false,
      offerType: "discount_10",
      offerValue: null,
      messageTemplate: null,
      templateName: "winback_he",
      templateLanguage: "he",
    });
    const res = await sendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.success).toBe(true);
    const arg = send.mock.calls[0][0] as { templateId: string; templateVariables: Record<string, string> };
    expect(arg.templateId).toBe("winback_he");
    expect(arg.templateVariables["2"]).toBe("סטודיו יופי");
  });
});

describe("sendManualClientWhatsAppAction — appointment_reminder & review_request", () => {
  it("errors on appointment_reminder when real send is on without a template", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: null });
    const res = await sendManualClientWhatsAppAction("cli_1", "appointment_reminder");
    expect(res.error).toContain("תזכורת");
    expect(send).not.toHaveBeenCalled();
  });

  it("builds and sends an appointment_reminder with 3 template variables", async () => {
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "appt_he",
      templateLanguage: "he",
      messageTemplate: null,
    });
    const res = await sendManualClientWhatsAppAction("cli_1", "appointment_reminder");
    expect(res.success).toBe(true);
    const arg = send.mock.calls[0][0] as { templateVariables: Record<string, string> };
    expect(arg.templateVariables["3"]).toBe("מניקור");
  });

  it("errors on review_request when real send is on without a template", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: null });
    const res = await sendManualClientWhatsAppAction("cli_1", "review_request");
    expect(res.error).toContain("ביקורת");
    expect(send).not.toHaveBeenCalled();
  });

  it("builds and sends a review_request, threading the review link into variables", async () => {
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "review_he",
      templateLanguage: "he",
      messageTemplate: null,
      offerValue: "https://g.page/review",
    });
    const res = await sendManualClientWhatsAppAction("cli_1", "review_request");
    expect(res.success).toBe(true);
    const arg = send.mock.calls[0][0] as { templateVariables: Record<string, string> };
    expect(arg.templateVariables["3"]).toBe("https://g.page/review");
  });
});

describe("sendManualClientWhatsAppAction — provider result branches", () => {
  it("returns success (no error) when the provider mock-skips the send (dev mode)", async () => {
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: "hello_world", templateLanguage: "en_US" });
    send.mockResolvedValue({ success: false, isMockSkip: true });
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.success).toBe(true);
    expect(res.isTestMode).toBe(false);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
  });

  it("returns a test-mode-block error when the provider blocks a non-test recipient", async () => {
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: "hello_world", templateLanguage: "en_US" });
    send.mockResolvedValue({ success: false, isTestModeBlock: true });
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toContain("מצב בדיקה");
  });

  it("redirects the recipient to the test phone and returns isTestMode=true on success", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.WHATSAPP_TEST_PHONE = "+972544961155";
    primeSendableState();
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: "hello_world", templateLanguage: "en_US" });
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.success).toBe(true);
    expect(res.isTestMode).toBe(true);
    // The provider was called with the test phone, NOT the client's real number.
    const arg = send.mock.calls[0][0] as { toPhone: string };
    expect(arg.toPhone).toBe("+972544961155");
  });
});
