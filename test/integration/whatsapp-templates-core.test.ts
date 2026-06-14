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

  it("reports partial success when some creations error", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate
      .mockResolvedValueOnce({ ok: true, status: "pending" })
      .mockResolvedValue({ ok: false, error: "boom" });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(true); // at least one created
    expect(res.items.some((i) => i.status === "error")).toBe(true);
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
