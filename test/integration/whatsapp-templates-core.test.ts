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
  // No pre-existing templates by default → nothing is skipped.
  prisma.automationSetting.findMany.mockResolvedValue([]);
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

  it("skips already-pending/approved templates on a full batch — never recreates them", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });
    // review + win_back are already pending in Meta from the prior attempt.
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: "review_request", templateStatus: "pending" },
      { type: "win_back", templateStatus: "approved" },
    ]);

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);

    // Only the 2 not-yet-pending templates reach Meta; the pending pair is left alone.
    expect(createTemplate).toHaveBeenCalledTimes(DEFAULT_TEMPLATES.length - 2);
    const sentNames = createTemplate.mock.calls.map((c) => (c[2] as { name: string }).name);
    expect(sentNames).not.toContain("review_request_he");
    expect(sentNames).not.toContain("win_back_offer_he");
    // The skipped templates still appear in the result with their existing status.
    expect(res.items.find((i) => i.name === "review_request_he")?.status).toBe("pending");
    expect(res.items.find((i) => i.name === "win_back_offer_he")?.status).toBe("approved");
  });

  it("per-row retry (onlyName) re-attempts even when other templates are pending", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });
    // A pending sibling exists, but onlyName must still re-attempt the target.
    prisma.automationSetting.findMany.mockResolvedValue([
      { type: "review_request", templateStatus: "pending" },
    ]);

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A, "booking_confirmation_he");
    expect(createTemplate).toHaveBeenCalledTimes(1);
    expect(res.items[0].name).toBe("booking_confirmation_he");
  });

  it("surfaces Meta code 100 / subcode 2388024 clearly per template", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({
      ok: false,
      error: "Invalid parameter [code 100 · subcode 2388024 · trace Tr9]",
      metaError: { message: "Invalid parameter", code: 100, errorSubcode: 2388024, fbtraceId: "Tr9" },
    });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A, "booking_confirmation_he");
    const item = res.items[0];
    expect(item.status).toBe("error");
    expect(item.errorSubcode).toBe(2388024);
    expect(item.fbtraceId).toBe("Tr9");
    expect(item.error).toContain("100");
  });

  it("reports total failure without ever marking the connection disconnected", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: false, error: "Invalid parameter" });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);
    expect(res.success).toBe(false);
    // Failure copy frames this as a template problem, NOT a connection problem.
    expect(res.statusLabel).toContain("WhatsApp מחובר");
    expect(res.statusLabel).toContain("יצירת התבניות נכשלה");
    expect(res.operationalReady).toBe(false);
  });

  it("a win_back (marketing) failure does NOT fail the whole setup — operational stays ready", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    // Operational templates succeed; only the marketing win-back template fails.
    createTemplate.mockImplementation((_waba, _token, tpl: { name: string }) =>
      tpl.name === "win_back_offer_he"
        ? Promise.resolve({
            ok: false,
            error: "Invalid parameter [code 100 · subcode 2388024]",
            metaError: { message: "Invalid parameter", code: 100, errorSubcode: 2388024, fbtraceId: "TrM" },
          })
        : Promise.resolve({ ok: true, status: "pending" }),
    );

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A);

    // Operational readiness is separate from (and unaffected by) marketing failure.
    expect(res.operationalReady).toBe(true);
    expect(res.marketingFailed).toBe(true);
    expect(res.marketingReady).toBe(false);
    // Setup is still considered usable — never a global failure.
    expect(res.success).toBe(true);
    // Owner-facing copy: operational fine, marketing handled separately.
    expect(res.statusLabel).toContain("תבניות תפעוליות נשלחו לאישור");
    expect(res.statusLabel).toContain("תבנית החזרת לקוחות נכשלה ותטופל בנפרד");
    // The marketing error is surfaced per-template for the admin debug table.
    const marketingItem = res.items.find((i) => i.name === "win_back_offer_he");
    expect(marketingItem?.status).toBe("error");
    expect(marketingItem?.errorSubcode).toBe(2388024);
  });

  it("retrying ONLY the marketing template never recreates the pending utility templates", async () => {
    getCreds.mockResolvedValue({ accessToken: REAL_TOKEN, wabaId: "waba_1", apiVersion: "v19.0" });
    createTemplate.mockResolvedValue({ ok: true, status: "pending" });

    const res = await createDefaultTemplatesForBusiness(BUSINESS_A, "win_back_offer_he");

    // Exactly one create call — only the marketing template was retried.
    expect(createTemplate).toHaveBeenCalledTimes(1);
    const sentNames = createTemplate.mock.calls.map((c) => (c[2] as { name: string }).name);
    expect(sentNames).toEqual(["win_back_offer_he"]);
    expect(sentNames).not.toContain("booking_confirmation_he");
    expect(sentNames).not.toContain("appointment_reminder_he");
    expect(sentNames).not.toContain("review_request_he");
    expect(res.items).toHaveLength(1);
    expect(res.items[0].name).toBe("win_back_offer_he");
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
