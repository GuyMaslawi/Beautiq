import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Branch coverage for retryAutomationMessageAction beyond the guard suite:
 * the successful resend path, the test-mode-block and plain-failure error
 * messages, and the thrown-send catch path. A controllable provider lets us
 * drive each provider.send() outcome.
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

const requireTenant = vi.fn();
vi.mock("@/server/auth/session", () => ({ requireTenant: () => requireTenant() }));

const send = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: vi.fn(async () => ({ name: "stub", send })),
}));

import { retryAutomationMessageAction } from "@/server/automations/retry-action";

function failedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    runId: "run_1",
    clientId: "cli_1",
    phone: "+972501234567",
    templateId: "tpl_he",
    messageText: "היי",
    status: "failed",
    retryCount: 0,
    client: { id: "cli_1", businessId: BUSINESS_A, unsubscribedAt: null, normalizedPhone: "+972501234567" },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requireTenant.mockReset().mockResolvedValue({ businessId: BUSINESS_A });
  send.mockReset();
  prisma.automationMessage.update.mockResolvedValue({ id: "msg_1" });
});

describe("retryAutomationMessageAction — send outcomes", () => {
  it("marks the message sent and clears the failure reason on a successful resend", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockResolvedValue({ success: true, providerMessageId: "wamid.R" });
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(true);
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg_1", businessId: BUSINESS_A },
        data: expect.objectContaining({
          status: "sent",
          providerMessageId: "wamid.R",
          failureReason: null,
          retryCount: { increment: 1 },
        }),
      }),
    );
    // Provider was invoked with the stored template + phone.
    const arg = send.mock.calls[0][0] as { templateId: string; toPhone: string };
    expect(arg.templateId).toBe("tpl_he");
    expect(arg.toPhone).toBe("+972501234567");
  });

  it("returns the test-mode-block message and records the attempt on isTestModeBlock", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockResolvedValue({ success: false, isTestModeBlock: true });
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toContain("מצב בדיקה");
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ retryCount: { increment: 1 } }) }),
    );
  });

  it("surfaces the provider failureReason on a plain failure", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockResolvedValue({ success: false, failureReason: "תבנית נדחתה" });
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("תבנית נדחתה");
  });

  it("falls back to a generic failure message when none is provided", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockResolvedValue({ success: false });
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("שליחה נכשלה");
  });

  it("catches a thrown send error, increments retry, and returns the error message", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockRejectedValue(new Error("connection reset"));
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("connection reset");
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { retryCount: { increment: 1 }, lastRetryAt: expect.any(Date) } }),
    );
  });

  it("uses a generic Hebrew message when a non-Error value is thrown", async () => {
    prisma.automationMessage.findFirst.mockResolvedValue(failedMessage());
    send.mockRejectedValue("string failure");
    const res = await retryAutomationMessageAction("msg_1");
    expect(res.success).toBe(false);
    expect(res.error).toBe("שגיאה לא ידועה");
  });
});
