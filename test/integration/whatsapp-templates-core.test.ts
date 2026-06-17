import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BUSINESS_A } from "../helpers/factories";

/**
 * templates-core orchestrates Meta template creation/sync. It must:
 *   - Refuse to act when WhatsApp is not connected (no wabaId) — never calls Meta.
 *   - Pass the businessId-scoped credentials through; never leak the token.
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

const getCreds = vi.fn();
vi.mock("@/server/whatsapp/resolver", () => ({
  getDecryptedCredentialsForBusiness: (...a: unknown[]) => getCreds(...a),
}));

const createTemplate = vi.fn();
const listTemplates = vi.fn();
vi.mock("@/lib/whatsapp/meta-templates-api", () => ({
  createTemplate: (...a: unknown[]) => createTemplate(...a),
  listTemplates: (...a: unknown[]) => listTemplates(...a),
  buildSanitizedTemplatePayload: (t: { name: string }) => ({ name: t.name }),
}));

const validateTemplateBatch = vi.fn();
vi.mock("@/lib/whatsapp/template-validation", () => ({
  validateTemplateBatch: (...a: unknown[]) => validateTemplateBatch(...a),
}));

import { resetPrismaMock } from "../helpers/prisma-mock";
import {
  createDefaultTemplatesForBusiness,
  syncTemplatesForBusiness,
} from "@/server/whatsapp/templates-core";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp/default-templates";

const REAL_TOKEN = "EAAsecret-token-zzz";

beforeEach(() => {
  resetPrismaMock(prisma);
  getCreds.mockReset();
  createTemplate.mockReset();
  listTemplates.mockReset();
  validateTemplateBatch.mockReset();
  // Default: every template passes local validation.
  validateTemplateBatch.mockImplementation((templates: Array<{ name: string }>) =>
    templates.map((t) => ({ name: t.name, result: { ok: true, errors: [] } })),
  );
  prisma.automationSetting.upsert.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDefaultTemplatesForBusiness", () => {
  it("fails safely without a wabaId and never calls Meta", async () => {
    getCreds.mockResolvedValue(null);
    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(false);
    expect(res.statusLabel).toContain("WhatsApp לא מחובר");
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("creates all default templates and stores statuses scoped to the business", async () => {
    getCreds.mockResolvedValue({
      accessToken: REAL_TOKEN,
      wabaId: "waba_1",
      apiVersion: "v19.0",
    });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);

    expect(res.success).toBe(true);
    expect(createTemplate).toHaveBeenCalledTimes(DEFAULT_TEMPLATES.length);
    // upsert is scoped to the business via businessId_type compound key.
    const upsertArg = prisma.automationSetting.upsert.mock.calls[0][0] as {
      where: { businessId_type: { businessId: string } };
    };
    expect(upsertArg.where.businessId_type.businessId).toBe(BUSINESS_A);
  });

  it("reports partial success when some creations error (per-template result)", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate
      .mockResolvedValueOnce({ ok: true, status: "pending" })
      .mockResolvedValue({
        ok: false,
        error: "Invalid parameter [code 100]",
        metaError: { message: "Invalid parameter", code: 100, errorSubcode: 2388043, fbtraceId: "Tr1" },
      });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(true); // at least one created → not a total failure
    expect(res.items.some((i) => i.status === "error")).toBe(true);
    // Meta diagnostics flow through to the per-template item for the debug table.
    const failed = res.items.find((i) => i.status === "error");
    expect(failed?.errorSubcode).toBe(2388043);
    expect(failed?.fbtraceId).toBe("Tr1");
  });

  it("blocks a locally-invalid template and never calls Meta for it", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });
    // Force the first template to fail local validation.
    validateTemplateBatch.mockImplementation((templates: Array<{ name: string }>) =>
      templates.map((t, i) => ({
        name: t.name,
        result: i === 0 ? { ok: false, errors: ["שם התבנית לא תקין."] } : { ok: true, errors: [] },
      })),
    );

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);

    // Only the valid templates were sent to Meta.
    expect(createTemplate).toHaveBeenCalledTimes(DEFAULT_TEMPLATES.length - 1);
    const invalid = res.items.find((i) => i.status === "invalid");
    expect(invalid).toBeDefined();
    expect(invalid?.localValid).toBe(false);
    expect(invalid?.validationError).toContain("שם התבנית");
  });

  it("creates a single template by name when onlyName is given", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });

    const target = DEFAULT_TEMPLATES[0].name;
    const res = await createDefaultTemplatesForBusiness(BUSINESS_A, target);

    expect(createTemplate).toHaveBeenCalledTimes(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].name).toBe(target);
  });

  it("reports total failure without ever marking the connection disconnected", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: false, error: "Invalid parameter" });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(false);
    // Failure copy frames this as a template problem, NOT a connection problem.
    expect(res.statusLabel).toContain("WhatsApp מחובר");
    expect(res.statusLabel).toContain("יצירת התבניות נכשלה");
  });
});

describe("syncTemplatesForBusiness", () => {
  it("fails safely without a wabaId and never lists templates", async () => {
    getCreds.mockResolvedValue(null);
    const res = await syncTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(false);
    expect(listTemplates).not.toHaveBeenCalled();
  });

  it("matches existing templates by name+language and stores statuses", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    listTemplates.mockResolvedValue({
      ok: true,
      templates: DEFAULT_TEMPLATES.map((t) => ({
        name: t.name,
        language: t.language,
        status: "approved",
      })),
    });

    const res = await syncTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(true);
    expect(res.statusLabel).toContain("סונכרנו");
    expect(prisma.automationSetting.upsert).toHaveBeenCalledTimes(DEFAULT_TEMPLATES.length);
  });

  it("reports failure when listing fails", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    listTemplates.mockResolvedValue({ ok: false, error: "nope" });
    const res = await syncTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(false);
  });
});
