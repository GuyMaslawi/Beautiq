import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Embedded Signup completes the per-business connection. SECURITY:
 *   - The owner-facing result NEVER contains the token, WABA id, or phone number id.
 *   - The stored token is encrypted (accessTokenEncrypted is ciphertext, not plaintext).
 *   - Failures persist status=error with a scrubbed message (no token).
 *   - Missing encryption key -> refuses to store, saves an error connection.
 */

vi.mock("@/server/db/prisma", async () => {
  const { createPrismaMock } = await import("../helpers/prisma-mock");
  const g = globalThis as Record<string, unknown>;
  g.__prismaMock ??= createPrismaMock();
  return { prisma: g.__prismaMock };
});
const prisma = (globalThis as Record<string, unknown>)
  .__prismaMock as ReturnType<typeof import("../helpers/prisma-mock").createPrismaMock>;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireCurrentBusiness = vi.fn(async () => ({ id: BUSINESS_A }));
vi.mock("@/server/auth/session", () => ({
  requireCurrentBusiness: (...a: unknown[]) => (requireCurrentBusiness as (...x: unknown[]) => unknown)(...a),
}));

const exchangeCodeForToken = vi.fn();
const registerPhoneNumber = vi.fn();
const subscribeAppToWaba = vi.fn();
const fetchPhoneNumberInfo = vi.fn();
const fetchFirstWabaPhoneNumber = vi.fn();
vi.mock("@/lib/whatsapp/meta-onboarding", () => ({
  exchangeCodeForToken: (...a: unknown[]) => exchangeCodeForToken(...a),
  registerPhoneNumber: (...a: unknown[]) => registerPhoneNumber(...a),
  subscribeAppToWaba: (...a: unknown[]) => subscribeAppToWaba(...a),
  fetchPhoneNumberInfo: (...a: unknown[]) => fetchPhoneNumberInfo(...a),
  fetchFirstWabaPhoneNumber: (...a: unknown[]) => fetchFirstWabaPhoneNumber(...a),
  derivePin: (s: string) => s.slice(0, 6).padStart(6, "0"),
  // scrubToken must behave like the real implementation for leak assertions.
  scrubToken: (m: string) => m.replace(/EAA\S+/g, "[token]"),
}));

type TplItem = { label: string; name: string; status: string; error?: string };
const createDefaultTemplatesForBusiness = vi.fn(
  async (): Promise<{ success: boolean; statusLabel: string; items: TplItem[] }> => ({
    success: true,
    statusLabel: "ok",
    items: [],
  }),
);
vi.mock("@/server/whatsapp/templates-core", () => ({
  createDefaultTemplatesForBusiness: (...a: unknown[]) => (createDefaultTemplatesForBusiness as (...x: unknown[]) => unknown)(...a),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import {
  completeEmbeddedSignupAction,
  disconnectWhatsAppAction,
} from "@/server/whatsapp/embedded-signup-actions";
import { decryptToken } from "@/lib/whatsapp/crypto";

const REAL_TOKEN = "EAAlong-lived-system-user-token-abc123";
const ENCRYPTION_KEY = "a".repeat(64);

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPrismaMock(prisma);
  requireCurrentBusiness.mockReset().mockResolvedValue({ id: BUSINESS_A });
  exchangeCodeForToken.mockReset();
  registerPhoneNumber.mockReset().mockResolvedValue({ ok: true });
  subscribeAppToWaba.mockReset().mockResolvedValue({ ok: true });
  fetchPhoneNumberInfo.mockReset().mockResolvedValue({ ok: true, displayPhoneNumber: "+972500000000" });
  fetchFirstWabaPhoneNumber.mockReset();
  createDefaultTemplatesForBusiness.mockClear();
  prisma.whatsAppConnection.upsert.mockResolvedValue({});
  prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 1 });
  process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedText(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls]
    .map((c) => c.map((x) => String(x)).join(" "))
    .join("\n");
}

describe("completeEmbeddedSignupAction", () => {
  it("returns 'החיבור בוטל' when no code (no token exchange)", async () => {
    const res = await completeEmbeddedSignupAction({ code: "" });
    expect(res.success).toBe(false);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("refuses and saves an error connection when encryption key is missing", async () => {
    delete process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
    const res = await completeEmbeddedSignupAction({ code: "c", wabaId: "w", phoneNumberId: "p" });
    expect(res.success).toBe(false);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
    // An error connection was persisted.
    const lastUpsert = prisma.whatsAppConnection.upsert.mock.calls.at(-1)?.[0] as {
      update: { status: string };
    };
    expect(lastUpsert.update.status).toBe("error");
  });

  it("happy path: stores ENCRYPTED token, never returns/logs plaintext", async () => {
    exchangeCodeForToken.mockResolvedValue({ ok: true, accessToken: REAL_TOKEN, expiresInSeconds: 3600 });

    const res = await completeEmbeddedSignupAction({
      code: "auth_code",
      wabaId: "waba_1",
      phoneNumberId: "phone_1",
    });

    expect(res.success).toBe(true);
    // Owner-facing result must not contain any internal id or token.
    const resStr = JSON.stringify(res);
    expect(resStr).not.toContain(REAL_TOKEN);
    expect(resStr).not.toContain("waba_1");
    expect(resStr).not.toContain("phone_1");

    // The saved connection stores an ENCRYPTED token (not plaintext) that decrypts back.
    const activeUpsert = prisma.whatsAppConnection.upsert.mock.calls
      .map((c) => c[0] as { create: { status?: string; accessTokenEncrypted?: string } })
      .find((c) => c.create.status === "active");
    expect(activeUpsert).toBeDefined();
    const stored = activeUpsert!.create.accessTokenEncrypted!;
    expect(stored).not.toContain(REAL_TOKEN);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(decryptToken(stored)).toBe(REAL_TOKEN);

    // Token must never be logged.
    expect(loggedText()).not.toContain(REAL_TOKEN);
  });

  it("token exchange failure saves error with scrubbed message (no token leak)", async () => {
    exchangeCodeForToken.mockResolvedValue({ ok: false, error: `failed for ${REAL_TOKEN}` });

    const res = await completeEmbeddedSignupAction({ code: "c", wabaId: "w", phoneNumberId: "p" });
    expect(res.success).toBe(false);

    // The persisted lastError must be scrubbed.
    const errorUpsert = prisma.whatsAppConnection.upsert.mock.calls
      .map((c) => c[0] as { update: { status?: string; lastError?: string } })
      .find((c) => c.update.status === "error");
    expect(errorUpsert?.update.lastError).not.toContain(REAL_TOKEN);
  });

  it("missing wabaId saves an error connection", async () => {
    exchangeCodeForToken.mockResolvedValue({ ok: true, accessToken: REAL_TOKEN });
    const res = await completeEmbeddedSignupAction({ code: "c", phoneNumberId: "p" });
    expect(res.success).toBe(false);
  });

  it("template creation failure keeps the connection SUCCESSFUL (separated from connection failure)", async () => {
    exchangeCodeForToken.mockResolvedValue({ ok: true, accessToken: REAL_TOKEN, expiresInSeconds: 3600 });
    createDefaultTemplatesForBusiness.mockResolvedValueOnce({
      success: false,
      statusLabel: "חלק מהתבניות נכשלו",
      items: [{ label: "תזכורת", name: "reminder", status: "error", error: "Template text too long" }],
    });

    const res = await completeEmbeddedSignupAction({
      code: "auth_code",
      wabaId: "waba_1",
      phoneNumberId: "phone_1",
    });

    // The connection itself succeeded — template failure must NOT reset it.
    expect(res.success).toBe(true);
    expect(res.templatesPrepared).toBe(false);
    expect(res.statusLabel).toBe("WhatsApp מחובר, אך יצירת התבניות נכשלה");
    expect(res.templateError).toBeDefined();

    // The connection was still saved as ACTIVE.
    const activeUpsert = prisma.whatsAppConnection.upsert.mock.calls
      .map((c) => c[0] as { create: { status?: string } })
      .find((c) => c.create.status === "active");
    expect(activeUpsert).toBeDefined();
  });

  it("template success returns a clean 'WhatsApp מחובר' with templatesPrepared=true", async () => {
    exchangeCodeForToken.mockResolvedValue({ ok: true, accessToken: REAL_TOKEN, expiresInSeconds: 3600 });
    // default createDefaultTemplatesForBusiness mock resolves success:true
    const res = await completeEmbeddedSignupAction({
      code: "auth_code",
      wabaId: "waba_1",
      phoneNumberId: "phone_1",
    });
    expect(res.success).toBe(true);
    expect(res.templatesPrepared).toBe(true);
    expect(res.statusLabel).toBe("WhatsApp מחובר");
  });
});

describe("disconnectWhatsAppAction", () => {
  it("clears the encrypted token and marks not_connected, scoped to the business", async () => {
    const res = await disconnectWhatsAppAction();
    expect(res.success).toBe(true);
    expect(prisma.whatsAppConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        data: expect.objectContaining({
          status: "not_connected",
          accessTokenEncrypted: null,
        }),
      }),
    );
  });
});
