import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * Admin-only WhatsApp actions (server/admin/whatsapp-actions.ts).
 *
 * SECURITY:
 *   - Every action requires a platform admin (requirePlatformAdmin).
 *   - The access token is read from env, verified against Meta (mocked fetch),
 *     and NEVER stored in the DB or returned to the caller (useEnvFallback=true).
 *   - On verification failure the connection is saved with status=error and a
 *     token-scrubbed lastError.
 *   - disconnect is scoped by businessId and clears the stored token.
 *   - Template create/sync only call mocked Meta helpers — no real send.
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

const requirePlatformAdmin = vi.fn(async () => undefined);
vi.mock("@/server/admin/auth", () => ({
  requirePlatformAdmin: (...a: unknown[]) => requirePlatformAdmin(...(a as [])),
}));

const getWhatsAppDiagnostic = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getWhatsAppDiagnostic: (...a: unknown[]) => getWhatsAppDiagnostic(...(a as [])),
}));

const createDefaultTemplatesForBusiness = vi.fn();
const syncTemplatesForBusiness = vi.fn();
vi.mock("@/server/whatsapp/templates-core", () => ({
  createDefaultTemplatesForBusiness: (...a: unknown[]) =>
    createDefaultTemplatesForBusiness(...(a as [])),
  syncTemplatesForBusiness: (...a: unknown[]) => syncTemplatesForBusiness(...(a as [])),
}));

// Provider factory is only referenced (void) for an unused-warning suppress — stub it.
vi.mock("@/lib/whatsapp/meta-cloud-api", () => ({
  createMetaCloudApiProvider: vi.fn(() => ({ send: vi.fn() })),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import {
  adminConnectBusinessFromEnv,
  adminCheckWhatsAppDiagnostic,
  adminCreateTemplatesForBusiness,
  adminSyncTemplatesForBusiness,
  adminDisconnectBusiness,
} from "@/server/admin/whatsapp-actions";

const REAL_TOKEN = "EAAadminSystemUserToken999";

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function mockFetch(opts: { ok: boolean; status?: number; json: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: opts.ok,
      status: opts.status ?? (opts.ok ? 200 : 400),
      json: async () => opts.json,
    })),
  );
}

beforeEach(() => {
  resetPrismaMock(prisma);
  requirePlatformAdmin.mockReset().mockResolvedValue(undefined);
  getWhatsAppDiagnostic.mockReset();
  createDefaultTemplatesForBusiness.mockReset();
  syncTemplatesForBusiness.mockReset();
  prisma.business.findUnique.mockResolvedValue({ id: BUSINESS_A, name: "סטודיו" });
  prisma.whatsAppConnection.upsert.mockResolvedValue({});
  prisma.whatsAppConnection.updateMany.mockResolvedValue({ count: 1 });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function loggedText(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls]
    .map((c) => c.map((x) => String(x)).join(" "))
    .join("\n");
}

function upsertCalls() {
  return prisma.whatsAppConnection.upsert.mock.calls.map(
    (c) => c[0] as { create: Record<string, unknown>; update: Record<string, unknown> },
  );
}

describe("adminConnectBusinessFromEnv — auth + validation", () => {
  it("requires a platform admin", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(adminConnectBusinessFromEnv(BUSINESS_A)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(prisma.business.findUnique).not.toHaveBeenCalled();
  });

  it("returns a safe result when the business does not exist", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);
    expect(res.success).toBe(false);
    expect(res.verified).toBe(false);
    expect(prisma.whatsAppConnection.upsert).not.toHaveBeenCalled();
  });

  it("fails safely when the access token env var is missing (no fetch, no token)", async () => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pn_1";
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res)).not.toContain(REAL_TOKEN);
  });

  it("fails safely when the phone number id env var is missing", async () => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);
    expect(res.success).toBe(false);
  });
});

describe("adminConnectBusinessFromEnv — verification", () => {
  beforeEach(() => {
    process.env.META_WHATSAPP_ACCESS_TOKEN = REAL_TOKEN;
    process.env.META_WHATSAPP_PHONE_NUMBER_ID = "pn_1";
    process.env.META_WHATSAPP_WABA_ID = "waba_1";
  });

  it("persists an ACTIVE env-fallback connection on success without storing/returning the token", async () => {
    mockFetch({ ok: true, json: { display_phone_number: "+972500000000" } });
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);

    expect(res.success).toBe(true);
    expect(res.verified).toBe(true);
    // token never returned
    expect(JSON.stringify(res)).not.toContain(REAL_TOKEN);

    const call = upsertCalls()[0];
    expect(call.create.status).toBe("active");
    expect(call.create.useEnvFallback).toBe(true);
    expect(call.create.phoneNumberId).toBe("pn_1");
    expect(call.create.wabaId).toBe("waba_1");
    // token is NOT persisted in the connection row
    expect(JSON.stringify(call)).not.toContain(REAL_TOKEN);
    // token never logged
    expect(loggedText()).not.toContain(REAL_TOKEN);
  });

  it("persists status=error with a scrubbed message on verification failure", async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: { error: { message: `invalid oauth ${REAL_TOKEN}` } },
    });
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);

    expect(res.success).toBe(false);
    expect(res.verified).toBe(false);
    const call = upsertCalls()[0];
    expect(call.create.status).toBe("error");
    expect(String(call.create.lastError)).not.toContain(REAL_TOKEN);
    expect(loggedText()).not.toContain(REAL_TOKEN);
  });

  it("handles a network error safely (status=error, no throw)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error(`network blew up ${REAL_TOKEN}`);
    }));
    const res = await adminConnectBusinessFromEnv(BUSINESS_A);
    expect(res.success).toBe(false);
    const call = upsertCalls()[0];
    expect(call.create.status).toBe("error");
    expect(JSON.stringify(call)).not.toContain(REAL_TOKEN);
  });
});

describe("adminCheckWhatsAppDiagnostic", () => {
  it("requires admin and returns the resolver diagnostic (no secrets)", async () => {
    getWhatsAppDiagnostic.mockResolvedValue({
      ok: true,
      statusLabel: "מחובר",
      details: [{ label: "טוקן", ok: true }],
    });
    const res = await adminCheckWhatsAppDiagnostic(BUSINESS_A);
    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(getWhatsAppDiagnostic).toHaveBeenCalledWith(BUSINESS_A);
    expect(JSON.stringify(res)).not.toMatch(/EAA/);
  });
});

describe("template admin actions", () => {
  it("create delegates to the mocked Meta helper (no real send)", async () => {
    createDefaultTemplatesForBusiness.mockResolvedValue({
      success: true,
      statusLabel: "ok",
      items: [{ name: "t", status: "pending" }],
    });
    const res = await adminCreateTemplatesForBusiness(BUSINESS_A);
    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(createDefaultTemplatesForBusiness).toHaveBeenCalledWith(BUSINESS_A);
    expect(res.success).toBe(true);
  });

  it("sync delegates to the mocked Meta helper and surfaces statuses safely", async () => {
    syncTemplatesForBusiness.mockResolvedValue({
      success: true,
      statusLabel: "synced",
      items: [
        { name: "a", status: "approved" },
        { name: "b", status: "rejected" },
      ],
    });
    const res = await adminSyncTemplatesForBusiness(BUSINESS_A);
    expect(syncTemplatesForBusiness).toHaveBeenCalledWith(BUSINESS_A);
    expect(res.items.map((i: { status: string }) => i.status)).toEqual([
      "approved",
      "rejected",
    ]);
  });
});

describe("adminDisconnectBusiness", () => {
  it("requires admin, is scoped by businessId, and clears the stored token", async () => {
    const res = await adminDisconnectBusiness(BUSINESS_A);
    expect(requirePlatformAdmin).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(prisma.whatsAppConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: BUSINESS_A },
        data: expect.objectContaining({
          status: "not_connected",
          accessTokenEncrypted: null,
          useEnvFallback: false,
        }),
      }),
    );
  });
});
