import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPrismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin client actions (server/admin/client-actions.ts).
 *
 * SECURITY/TENANCY:
 *   - Every action requires a platform admin.
 *   - Updates and the manual WhatsApp send are scoped by the client's own
 *     businessId — never another tenant's connection/template.
 *   - Manual send respects opt-in guards, test-mode redirect, and records an
 *     audit trail (AutomationRun + AutomationMessage). The real send is mocked.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePlatformAdmin = vi.fn(async () => undefined);
vi.mock("@/server/admin/auth", () => ({
  requirePlatformAdmin: (...a: unknown[]) => requirePlatformAdmin(...(a as [])),
}));

const send = vi.fn();
const getWhatsAppProviderForBusiness = vi.fn(async () => ({ send }));
// Manual send routes through the resolver (managed sender by default; no
// per-business connection required). Tests flip `resolved.providerName` to
// "disabled" to simulate an unavailable connection.
const resolved = { providerName: "meta_cloud_api", uiStatus: "WhatsApp מחובר" };
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppProviderForBusiness: (...a: unknown[]) =>
    getWhatsAppProviderForBusiness(...(a as [])),
  resolveWhatsAppConnectionForBusiness: vi.fn(async () => ({
    provider: { name: resolved.providerName, send },
    uiStatus: resolved.uiStatus,
  })),
}));

const buildWinBackMessage = vi.fn(() => "win-back-text");
vi.mock("@/server/win-back-automation/message-builder", () => ({
  buildWinBackMessage: (...a: unknown[]) => buildWinBackMessage(...(a as [])),
}));

import {
  adminUpdateClientAction,
  adminDeleteClientsAction,
  adminSendManualClientWhatsAppAction,
  type AdminUpdateClientState,
} from "@/server/admin/client-actions";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.set(k, v);
  }
  return f;
}

const EMPTY: AdminUpdateClientState = {};

const ENV_KEYS = [
  "ENABLE_REAL_WHATSAPP_SEND",
  "WHATSAPP_TEST_MODE",
  "WHATSAPP_TEST_PHONE",
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  resetPrismaMock(prisma);
  requirePlatformAdmin.mockReset().mockResolvedValue(undefined);
  getWhatsAppProviderForBusiness.mockClear();
  send.mockReset();
  resolved.providerName = "meta_cloud_api";
  resolved.uiStatus = "WhatsApp מחובר";
  buildWinBackMessage.mockClear().mockReturnValue("win-back-text");
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

// ===========================================================================
// adminUpdateClientAction
// ===========================================================================

describe("adminUpdateClientAction", () => {
  it("requires a platform admin before reading", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      adminUpdateClientAction("cli_1", EMPTY, fd({ fullName: "x", phone: "0501234567" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it("returns formError when the client does not exist", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    const res = await adminUpdateClientAction("cli_1", EMPTY, fd({ fullName: "x", phone: "0501234567" }));
    expect(res).toEqual({ formError: "הלקוחה לא נמצאה" });
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("validates required name and phone", async () => {
    prisma.client.findUnique.mockResolvedValue({ id: "cli_1", businessId: BUSINESS_A });
    const res = await adminUpdateClientAction("cli_1", EMPTY, fd({ fullName: "", phone: "" }));
    expect(res.fieldErrors?.fullName).toBe("יש למלא את שם הלקוחה");
    expect(res.fieldErrors?.phone).toBe("יש למלא מספר טלפון");
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid Israeli phone", async () => {
    prisma.client.findUnique.mockResolvedValue({ id: "cli_1", businessId: BUSINESS_A });
    const res = await adminUpdateClientAction("cli_1", EMPTY, fd({ fullName: "דנה", phone: "123" }));
    expect(res.fieldErrors?.phone).toBe("מספר הטלפון לא תקין");
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("blocks a duplicate phone belonging to another client in the same business", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A }) // existing lookup
      .mockResolvedValueOnce({ id: "cli_other" }); // duplicate lookup
    const res = await adminUpdateClientAction(
      "cli_1",
      EMPTY,
      fd({ fullName: "דנה", phone: "0501234567" }),
    );
    expect(res.fieldErrors?.phone).toBe("כבר קיימת לקוחה עם מספר הטלפון הזה בעסק הזה");
    // duplicate lookup scoped by the client's own businessId
    const dupArg = prisma.client.findUnique.mock.calls[1][0] as {
      where: { businessId_normalizedPhone: { businessId: string } };
    };
    expect(dupArg.where.businessId_normalizedPhone.businessId).toBe(BUSINESS_A);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it("allows saving when the duplicate is the same client (self)", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce({ id: "cli_1" }); // same id = not a real duplicate
    prisma.client.update.mockResolvedValue({});
    const res = await adminUpdateClientAction(
      "cli_1",
      EMPTY,
      fd({ fullName: "דנה", phone: "0501234567" }),
    );
    expect(res).toEqual({ success: true });
    const updArg = prisma.client.update.mock.calls[0][0] as {
      where: { id: string };
      data: { fullName: string; phone: string };
    };
    expect(updArg.where).toEqual({ id: "cli_1" });
    // The admin update writes the editable client fields; opt-in gating was removed.
    expect(updArg.data.fullName).toBe("דנה");
    expect(updArg.data.phone).toBe("0501234567");
  });

  it("succeeds with no duplicate and trims blank email/notes to null", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce(null);
    prisma.client.update.mockResolvedValue({});
    const res = await adminUpdateClientAction(
      "cli_1",
      EMPTY,
      fd({ fullName: "דנה", phone: "0501234567", email: "", notes: "" }),
    );
    expect(res).toEqual({ success: true });
    const data = (prisma.client.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.email).toBeNull();
    expect(data.notes).toBeNull();
    // Opt-in gating was removed; the admin update no longer writes these fields.
    expect(data.whatsappOptIn).toBeUndefined();
    expect(data.marketingOptIn).toBeUndefined();
  });

  it("maps a unique-constraint DB error to a friendly phone field error", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce(null);
    prisma.client.update.mockRejectedValue(new Error("Unique constraint failed on the fields"));
    const res = await adminUpdateClientAction(
      "cli_1",
      EMPTY,
      fd({ fullName: "דנה", phone: "0501234567" }),
    );
    expect(res.fieldErrors?.phone).toBe("כבר קיימת לקוחה עם מספר הטלפון הזה בעסק הזה");
  });

  it("maps any other DB error to a safe generic formError (no leak)", async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce({ id: "cli_1", businessId: BUSINESS_A })
      .mockResolvedValueOnce(null);
    prisma.client.update.mockRejectedValue(new Error("connection reset secretZZZ"));
    const res = await adminUpdateClientAction(
      "cli_1",
      EMPTY,
      fd({ fullName: "דנה", phone: "0501234567" }),
    );
    expect(res).toEqual({ formError: "משהו השתבש. יש לנסות שוב בעוד רגע" });
    expect(JSON.stringify(res)).not.toContain("secretZZZ");
  });
});

// ===========================================================================
// adminDeleteClientsAction
// ===========================================================================

describe("adminDeleteClientsAction", () => {
  it("requires a platform admin", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(adminDeleteClientsAction(["cli_1"])).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.client.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a non-array argument", async () => {
    const res = await adminDeleteClientsAction(null as unknown as string[]);
    expect(res).toEqual({ error: "לא נבחרו לקוחות למחיקה" });
  });

  it("rejects an empty / all-invalid id list", async () => {
    const res = await adminDeleteClientsAction(["", null as unknown as string]);
    expect(res).toEqual({ error: "לא נבחרו לקוחות למחיקה" });
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });

  it("returns not-found when none of the ids exist", async () => {
    prisma.client.findMany.mockResolvedValue([]);
    const res = await adminDeleteClientsAction(["cli_1", "cli_1"]);
    expect(res).toEqual({ error: "הלקוחות לא נמצאו" });
    expect(prisma.client.deleteMany).not.toHaveBeenCalled();
  });

  it("de-dupes ids and deletes the existing ones, returning the count", async () => {
    prisma.client.findMany.mockResolvedValue([{ id: "cli_1" }, { id: "cli_2" }]);
    prisma.client.deleteMany.mockResolvedValue({ count: 2 });
    const res = await adminDeleteClientsAction(["cli_1", "cli_1", "cli_2", "cli_missing"]);
    expect(res).toEqual({ success: true, deletedCount: 2 });
    expect(prisma.client.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["cli_1", "cli_2"] } },
    });
  });

  it("returns a safe error when deleteMany throws", async () => {
    prisma.client.findMany.mockResolvedValue([{ id: "cli_1" }]);
    prisma.client.deleteMany.mockRejectedValue(new Error("fk violation secret"));
    const res = await adminDeleteClientsAction(["cli_1"]);
    expect(res).toEqual({ error: "המחיקה נכשלה. נסו שוב או פנו לתמיכה." });
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});

// ===========================================================================
// adminSendManualClientWhatsAppAction
// ===========================================================================

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cli_1",
    businessId: BUSINESS_A,
    fullName: "דנה",
    phone: "050-123-4567",
    normalizedPhone: "+972501234567",
    unsubscribedAt: null,
    whatsappOptIn: true,
    marketingOptIn: true,
    business: { id: BUSINESS_A, name: "סטודיו יופי", slug: "studio" },
    bookings: [{ id: "bkg_1", service: { name: "מניקור" } }],
    ...overrides,
  };
}

function okSendResult(overrides: Record<string, unknown> = {}) {
  return { success: true, providerMessageId: "wamid.123", ...overrides };
}

function primeAudit() {
  prisma.automationRun.create.mockResolvedValue({ id: "run_1" });
  prisma.automationMessage.create.mockResolvedValue({ id: "msg_1" });
  prisma.automationMessage.update.mockResolvedValue({});
  prisma.automationRun.update.mockResolvedValue({});
}

describe("adminSendManualClientWhatsAppAction — guards", () => {
  it("requires a platform admin", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(
      adminSendManualClientWhatsAppAction("cli_1", "manual_test"),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it("errors when the client is not found", async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "הלקוחה לא נמצאה" });
  });

  it("errors when the client has no valid phone", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow({ normalizedPhone: null }));
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "אין ללקוחה מספר טלפון תקין" });
  });

  it("errors when the client unsubscribed", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow({ unsubscribedAt: new Date() }));
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "הלקוחה הסירה עצמה מרשימת ההודעות" });
  });

  it("errors when the resolved WhatsApp sender is unavailable (disabled)", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    resolved.providerName = "disabled";
    resolved.uiStatus = "שירות ה-WhatsApp של Allura אינו זמין כרגע";
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "שירות ה-WhatsApp של Allura אינו זמין כרגע" });
    expect(send).not.toHaveBeenCalled();
  });

  it("falls back to a generic error when the disabled provider has no status label", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    resolved.providerName = "disabled";
    resolved.uiStatus = "";
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "שירות ה-WhatsApp אינו זמין כרגע" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("adminSendManualClientWhatsAppAction — win_back opt-in gating removed", () => {
  beforeEach(() => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    primeAudit();
  });

  // Opt-in gating was removed: win_back sends regardless of the legacy opt-in
  // flags. Only an explicit STOP (unsubscribedAt) excludes a client — that guard
  // is covered in the "guards" describe above.
  it("sends win_back even when the client lacks the legacy whatsappOptIn flag", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow({ whatsappOptIn: false }));
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "t",
      templateLanguage: "he",
    });
    send.mockResolvedValue(okSendResult());
    const res = await adminSendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends win_back even when the client lacks the legacy marketingOptIn flag", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow({ marketingOptIn: false }));
    prisma.automationSetting.findUnique.mockResolvedValue({
      templateName: "t",
      templateLanguage: "he",
    });
    send.mockResolvedValue(okSendResult());
    const res = await adminSendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.success).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("blocks win_back real send when no template is configured", async () => {
    process.env.ENABLE_REAL_WHATSAPP_SEND = "true";
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: false,
      templateName: null,
    });
    const res = await adminSendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res).toEqual({ error: "לא הוגדרה תבנית הודעה מתאימה לעסק הזה" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("adminSendManualClientWhatsAppAction — sending", () => {
  beforeEach(() => {
    prisma.client.findUnique.mockResolvedValue(clientRow());
    prisma.whatsAppConnection.findUnique.mockResolvedValue({ status: "active" });
    primeAudit();
  });

  it("sends a manual_test using hello_world fallback when no template, records audit, returns success", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    send.mockResolvedValue(okSendResult());

    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ success: true, isTestMode: false });

    // audit run + message scoped by businessId
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ businessId: BUSINESS_A, type: "manual" }) }),
    );
    const sendArg = send.mock.calls[0][0] as {
      businessId: string;
      toPhone: string;
      templateId: string;
      templateLanguage: string;
      templateVariables?: unknown;
    };
    expect(sendArg.businessId).toBe(BUSINESS_A);
    expect(sendArg.toPhone).toBe("+972501234567");
    expect(sendArg.templateId).toBe("hello_world");
    expect(sendArg.templateLanguage).toBe("en_US");
    // hello_world carries no positional variables
    expect(sendArg.templateVariables).toBeUndefined();

    // final message marked sent, run completed
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed", sentCount: 1 }) }),
    );
  });

  it("sends win_back with a configured template and 2 positional variables", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: false,
      templateName: "win_back_tpl",
      templateLanguage: "he",
      messageTemplate: null,
      offerType: "none",
      offerValue: null,
    });
    send.mockResolvedValue(okSendResult());

    const res = await adminSendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.success).toBe(true);
    expect(buildWinBackMessage).toHaveBeenCalled();
    const sendArg = send.mock.calls[0][0] as {
      templateId: string;
      templateLanguage: string;
      templateVariables: Record<string, string>;
    };
    expect(sendArg.templateId).toBe("win_back_tpl");
    expect(sendArg.templateLanguage).toBe("he");
    expect(sendArg.templateVariables).toEqual({ "1": "דנה", "2": "סטודיו יופי" });
  });

  it("redirects the recipient to the test phone in test mode", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    process.env.WHATSAPP_TEST_PHONE = "+972500000000";
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    send.mockResolvedValue(okSendResult());

    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ success: true, isTestMode: true });
    const sendArg = send.mock.calls[0][0] as { toPhone: string };
    expect(sendArg.toPhone).toBe("+972500000000");
    // audit message recorded with the redirected phone
    expect(prisma.automationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "+972500000000" }) }),
    );
  });

  it("errors when test mode is on but no test phone is configured (no send)", async () => {
    process.env.WHATSAPP_TEST_MODE = "true";
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({
      error: "WHATSAPP_TEST_PHONE לא מוגדר — לא ניתן לשלוח במצב בדיקה",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("records skipped + success when the provider is the dev mock", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    send.mockResolvedValue({
      success: false,
      providerMessageId: null,
      isMockSkip: true,
      failureReason: DEV_MOCK_SKIP_REASON,
    });
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ success: true, isTestMode: false });
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", failedCount: 1 }) }),
    );
  });

  it("returns the test-mode-block error when the provider blocks the recipient", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    send.mockResolvedValue({
      success: false,
      providerMessageId: null,
      isTestModeBlock: true,
      failureReason: TEST_MODE_BLOCKED_REASON,
    });
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({
      error: "ההודעה נחסמה במצב בדיקה — הלקוחה אינה מספר הבדיקה",
    });
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
  });

  it("surfaces the sanitized Meta failure reason and logs the failure", async () => {
    prisma.automationSetting.findUnique.mockResolvedValue(null);
    // failureReason here is already the sanitized buildMetaErrorReason output.
    send.mockResolvedValue({
      success: false,
      providerMessageId: null,
      failureReason: "Message undeliverable [code 131026]",
      metaError: { code: 131026 },
    });
    const res = await adminSendManualClientWhatsAppAction("cli_1", "manual_test");
    expect(res).toEqual({ error: "Message undeliverable [code 131026]" });
    expect(prisma.automationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", errorCode: 131026 }),
      }),
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", failedCount: 1 }) }),
    );
  });

  it("handles a client with no completed bookings (lastServiceName undefined)", async () => {
    prisma.client.findUnique.mockResolvedValue(clientRow({ bookings: [] }));
    prisma.automationSetting.findUnique.mockResolvedValue({
      requireOptIn: false,
      templateName: "win_back_tpl",
      templateLanguage: "he",
      messageTemplate: null,
      offerType: "none",
      offerValue: null,
    });
    send.mockResolvedValue(okSendResult());
    const res = await adminSendManualClientWhatsAppAction("cli_1", "win_back");
    expect(res.success).toBe(true);
    const builderCalls = buildWinBackMessage.mock.calls as unknown as Array<
      [{ lastServiceName?: string }]
    >;
    expect(builderCalls[0][0].lastServiceName).toBeUndefined();
  });
});
