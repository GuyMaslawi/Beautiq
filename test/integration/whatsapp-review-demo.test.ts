import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A, makeWhatsAppConnection } from "../helpers/factories";

/**
 * Meta App Review demo mode.
 *
 * The review-demo status + test send must be HONEST and SAFE:
 *   - a disconnected business can never trigger a real send;
 *   - a connected business with real-send disabled can never trigger a real send;
 *   - only a fully-ready business sends, and only to the configured test recipient;
 *   - the owner-safe status never leaks a token or the raw test number;
 *   - every query is scoped by businessId.
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
import {
  getReviewDemoStatus,
  sendReviewDemoTestMessage,
} from "@/server/whatsapp/review-demo";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";

const ENCRYPTION_KEY = "a".repeat(64);
const ACCESS_TOKEN = "tok_super_secret_value_123";
const TEST_PHONE = "+972501112222";
const APPROVED = DEFAULT_TEMPLATES[0]; // booking_confirmation_he

/** Enables every server-side real-send guard. */
function enableRealSendEnv() {
  process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
  process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
  process.env.WHATSAPP_TEST_MODE = "true";
  process.env.WHATSAPP_TEST_PHONE = TEST_PHONE;
  process.env.META_WHATSAPP_ACCESS_TOKEN = ACCESS_TOKEN;
}

/** Connection + approved template + sample client all present. */
function mockReadyData() {
  prisma.whatsAppConnection.findUnique.mockResolvedValue(
    makeWhatsAppConnection({ status: "active", useEnvFallback: true, phoneNumberId: "pnid_1" }),
  );
  prisma.automationSetting.findMany.mockResolvedValue([
    { type: APPROVED.automationType, templateName: APPROVED.name, templateStatus: "approved", templateLanguage: "he" },
  ]);
  prisma.client.findFirst.mockResolvedValue({ id: "cli_demo_1" });
}

beforeEach(() => {
  resetPrismaMock(prisma);
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getReviewDemoStatus", () => {
  it("disconnected business: canTestSend=false, state=not_connected", async () => {
    enableRealSendEnv();
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: APPROVED.automationType, templateName: APPROVED.name, templateStatus: "approved", templateLanguage: "he" },
    ]);
    prisma.client.findFirst.mockResolvedValue({ id: "cli_demo_1" });

    const status = await getReviewDemoStatus(BUSINESS_A);
    expect(status.canTestSend).toBe(false);
    expect(status.state).toBe("not_connected");
  });

  it("connected but real send disabled: canTestSend=false, state=connected_disabled", async () => {
    // ENABLE_REAL_WHATSAPP_SEND intentionally NOT set (deleted by global setup).
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.WHATSAPP_TEST_PHONE = TEST_PHONE;
    mockReadyData();

    const status = await getReviewDemoStatus(BUSINESS_A);
    expect(status.canTestSend).toBe(false);
    expect(status.state).toBe("connected_disabled");
    expect(status.blockReason).toContain("ENABLE_REAL_WHATSAPP_SEND");
  });

  it("all guards pass: canTestSend=true, state=ready", async () => {
    enableRealSendEnv();
    mockReadyData();

    const status = await getReviewDemoStatus(BUSINESS_A);
    expect(status.canTestSend).toBe(true);
    expect(status.state).toBe("ready");
    expect(status.message).toContain("הודעת בדיקה");
  });

  it("owner-safe status never leaks the access token or the raw test number", async () => {
    enableRealSendEnv();
    mockReadyData();

    const status = await getReviewDemoStatus(BUSINESS_A);
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(ACCESS_TOKEN);
    expect(serialized).not.toContain(TEST_PHONE);
    expect(serialized).not.toContain("972501112222"); // raw digits, unmasked
    // Masked form keeps only the last 4 digits.
    const recipientCheck = status.checks.find((c) => c.label.includes("WHATSAPP_TEST_PHONE"));
    expect(recipientCheck?.value).toBe("•••• 2222");
  });

  it("status is business-scoped — every query carries the businessId", async () => {
    enableRealSendEnv();
    mockReadyData();

    await getReviewDemoStatus(BUSINESS_A);

    expect(prisma.whatsAppConnection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
    expect(prisma.automationSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: BUSINESS_A } }),
    );
  });
});

describe("sendReviewDemoTestMessage", () => {
  it("disconnected: refuses (blocked) and never creates an AutomationRun", async () => {
    enableRealSendEnv();
    prisma.whatsAppConnection.findUnique.mockResolvedValue(null);
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: APPROVED.automationType, templateName: APPROVED.name, templateStatus: "approved", templateLanguage: "he" },
    ]);
    prisma.client.findFirst.mockResolvedValue({ id: "cli_demo_1" });

    const result = await sendReviewDemoTestMessage(BUSINESS_A);
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
    expect(prisma.automationMessage.create).not.toHaveBeenCalled();
  });

  it("connected but real send disabled: refuses (blocked), no send attempted", async () => {
    process.env.WHATSAPP_PROVIDER = "meta_cloud_api";
    process.env.WHATSAPP_TEST_PHONE = TEST_PHONE;
    mockReadyData();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await sendReviewDemoTestMessage(BUSINESS_A);
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ready: sends ONE template to the test recipient and records the audit trail", async () => {
    enableRealSendEnv();
    mockReadyData();
    prisma.automationRun.create.mockResolvedValue({ id: "run_demo_1" });
    prisma.automationMessage.create.mockResolvedValue({ id: "msg_demo_1" });
    prisma.automationMessage.update.mockResolvedValue({});
    prisma.automationRun.update.mockResolvedValue({});

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.DEMO123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await sendReviewDemoTestMessage(BUSINESS_A);

    expect(result.success).toBe(true);
    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("wamid.DEMO123");

    // Exactly one send, to the configured test recipient (E.164 without '+').
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.to).toBe("972501112222");
    expect(body.template.name).toBe(APPROVED.name);

    // Audit trail recorded and marked sent.
    expect(prisma.automationRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BUSINESS_A,
          type: "manual",
          source: "review_demo",
          phone: TEST_PHONE,
        }),
      }),
    );
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
  });

  it("ready: never logs the access token", async () => {
    enableRealSendEnv();
    mockReadyData();
    prisma.automationRun.create.mockResolvedValue({ id: "run_demo_1" });
    prisma.automationMessage.create.mockResolvedValue({ id: "msg_demo_1" });
    prisma.automationMessage.update.mockResolvedValue({});
    prisma.automationRun.update.mockResolvedValue({});

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.DEMO123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendReviewDemoTestMessage(BUSINESS_A);

    const allLogs = [...logSpy.mock.calls, ...errSpy.mock.calls]
      .flat()
      .map(String)
      .join("\n");
    expect(allLogs).not.toContain(ACCESS_TOKEN);
  });
});
