import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A, BUSINESS_B, makeClient } from "../helpers/factories";

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireCurrentBusiness = vi.fn(async () => ({
  id: BUSINESS_A,
  name: "סטודיו יופי",
}));
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: (...args: unknown[]) => (requireCurrentBusiness as (...a: unknown[]) => unknown)(...args),
}));

// Provider send is mocked; default success.
const send = vi.fn(
  async (): Promise<{
    success: boolean;
    providerMessageId?: string;
    failureReason?: string;
  }> => ({ success: true, providerMessageId: "wamid.1" }),
);
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ send })),
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

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness
    .mockReset()
    .mockResolvedValue({ id: BUSINESS_A, name: "סטודיו יופי" });
  send.mockReset().mockResolvedValue({ success: true, providerMessageId: "wamid.1" });
  delete process.env.ENABLE_REAL_WHATSAPP_SEND;
  delete process.env.WHATSAPP_TEST_MODE;
  delete process.env.WHATSAPP_TEST_PHONE;
});

describe("sendManualClientWhatsAppAction — validation & tenant safety", () => {
  it("rejects a client owned by another business WITHOUT sending", async () => {
    prisma.client.findUnique.mockResolvedValue(
      clientRow({ businessId: BUSINESS_B }),
    );
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it("rejects a missing client", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    const res = await sendManualClientWhatsAppAction("ghost", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a client with an invalid phone", async () => {
    prisma.client.findUnique.mockResolvedValue(
      clientRow({ normalizedPhone: "+972123" }),
    );
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an unsubscribed client", async () => {
    prisma.client.findUnique.mockResolvedValue(
      clientRow({ unsubscribedAt: new Date("2026-06-01") }),
    );
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects when WhatsApp is not connected/active", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "disconnected" });
    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("blocks win_back when marketing opt-in is missing", async () => {
    prisma.client.findUnique.mockResolvedValue(
      clientRow({ marketingOptIn: false }),
    );
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: false,
      offerType: "none",
      offerValue: null,
      messageTemplate: null,
    });
    const res = await sendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a recent-message warning (and does not send) when a message was sent recently", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: null });
    prisma.automationMessage.count.mockResolvedValue(1); // recent message exists

    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.recentMessageWarning).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends successfully and logs run/message scoped to the business", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "hello_world",
      templateLanguage: "en_US",
    });
    prisma.automationMessage.count.mockResolvedValue(0);
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
    prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });

    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);

    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A, type: "manual" }),
      }),
    );
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: BUSINESS_A, clientId: "cli_1" }),
      }),
    );
    // provider invoked for the right business
    const sendArg = (send.mock.calls[0] as unknown[])[0] as { businessId: string };
    expect(sendArg.businessId).toBe(BUSINESS_A);
  });

  it("surfaces the sanitized Meta failure reason and persists structured error fields", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "hello_world",
      templateLanguage: "en_US",
    });
    prisma.automationMessage.count.mockResolvedValue(0);
    prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
    prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
    prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
    prisma.automationRun.update.mockResolvedValue({ id: "run_1" });
    // buildMetaErrorReason output — sanitized (only Meta's own fields, never a token).
    send.mockResolvedValue({
      success: false,
      failureReason: "Message failed to send [code 131026 · subcode 0]",
      metaError: {
        code: 131026,
        subcode: 0,
        type: "OAuthException",
        fbtraceId: "Atrace123",
        rawSanitized: '{"code":131026}',
      },
      phoneNumberIdUsed: "PN_LIVE",
    });

    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    // Sanitized Meta reason is shown to the owner/admin (Part 2 requirement).
    expect(res.error).toBe("Message failed to send [code 131026 · subcode 0]");
    // Structured Meta error fields are persisted on the message log.
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          errorCode: 131026,
          errorFbtraceId: "Atrace123",
          phoneNumberId: "PN_LIVE",
        }),
      }),
    );
  });

  it("errors when test mode is on but WHATSAPP_TEST_PHONE is unset", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    prisma.automationSetting.findUnique.mockResolvedValue({ templateName: "hello_world" });
    prisma.automationMessage.count.mockResolvedValue(0);

    const res = await sendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res.error).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });
});
