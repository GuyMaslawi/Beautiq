/**
 * Template setup core — businessId-parameterized, no auth.
 *
 * Shared by the owner actions (templates-actions.ts, scoped to the current
 * business) and the admin actions (whatsapp-actions.ts, scoped to an explicit
 * businessId). Auth is enforced by the callers, never here.
 *
 * Flow for "create": validate every template payload LOCALLY first, then call
 * Meta only for the valid ones. Invalid templates never reach Meta and report an
 * exact Hebrew reason. Per-template results carry safe Meta diagnostics (code,
 * subcode, fbtrace_id) for the admin debug table. A single template failure does
 * NOT fail the whole batch.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { getDecryptedCredentialsForBusiness } from "@/server/whatsapp/resolver";
import {
  DEFAULT_TEMPLATES,
  isOperationalTemplateName,
  type DefaultTemplate,
} from "@/lib/whatsapp/default-templates";
import {
  createTemplate,
  listTemplates,
  buildSanitizedTemplatePayload,
  type TemplateStatus,
  type SafeMetaTemplateError,
} from "@/lib/whatsapp/meta-templates-api";
import { validateTemplateBatch } from "@/lib/whatsapp/template-validation";

export interface TemplateSetupItem {
  label: string;
  name: string;
  category: string;
  language: string;
  /** Whether the payload passed local validation. */
  localValid: boolean;
  /** Exact Hebrew reason when local validation failed (never reaches Meta). */
  validationError?: string;
  /** "error" = Meta rejected; "invalid" = blocked locally. */
  status: TemplateStatus | "error" | "invalid";
  /** Single-line safe reason (Meta or local). */
  error?: string;
  /** Safe Meta error subcode, when Meta rejected the payload. */
  errorSubcode?: number;
  /** Meta fbtrace_id, when present — lets support correlate the failure. */
  fbtraceId?: string;
}

/**
 * Safe, token-free diagnostics for the "sync" action. Surfaces exactly which
 * WABA/phone ids were used, where they came from, and what Meta returned, so a
 * "לא נמצאה תבנית" result is debuggable without guessing. NEVER carries the
 * access token. Admin-only display.
 */
export interface SyncDiagnostics {
  /** WABA id used for listTemplates (the account we asked Meta about). */
  wabaId?: string;
  /** Where that WABA id came from: DB connection, env var, or unset. */
  wabaIdSource: "connection" | "env" | "none";
  /** True when META_WHATSAPP_WABA_ID is set in the environment. */
  envWabaIdPresent: boolean;
  /** Phone Number ID that real sends would use (NOT used for listTemplates). */
  phoneNumberId?: string;
  phoneNumberIdSource: "connection" | "env" | "none";
  /** Which resolver branch produced the credentials. */
  credentialMode: "allura_managed" | "per_business";
  apiVersion: string;
  /** How many templates Meta returned for this WABA. */
  returnedCount: number;
  /** The names/languages/categories/statuses Meta returned (raw + normalized). */
  returnedTemplates: Array<{
    name: string;
    language: string;
    category?: string;
    /** Normalized status (approved/pending/rejected/unknown). */
    status: TemplateStatus;
    /** Exact status string from Meta (e.g. "APPROVED"). */
    rawStatus?: string;
  }>;
  /** The 4 names+languages we look for, and whether each matched. */
  expected: Array<{ name: string; language: string; matched: boolean }>;
  /** When listTemplates itself failed (HTTP/permission/token), the safe reason. */
  listError?: string;
  listHttpStatus?: number;
  listErrorCode?: number;
  listErrorType?: string;
  /** A single-line Hebrew interpretation of the most likely root cause. */
  hint: string;
}

export interface TemplateSetupResult {
  success: boolean;
  /** Owner-facing Hebrew summary. */
  statusLabel: string;
  /** Per-template outcome for admin diagnostics. */
  items: TemplateSetupItem[];
  /** Safe diagnostics for the sync action (admin-only). Absent for create. */
  syncDiagnostics?: SyncDiagnostics;
  /**
   * True when every OPERATIONAL (core/transactional) template in this run is
   * pending/approved — i.e. the WhatsApp setup is usable for booking/reminder/
   * review messages, regardless of the optional marketing template.
   */
  operationalReady: boolean;
  /** True when every MARKETING template in this run is pending/approved. */
  marketingReady: boolean;
  /** True when at least one MARKETING template failed (Meta error / invalid). */
  marketingFailed: boolean;
}

/** A per-template item is "ok" when it reached Meta as pending/approved/unknown. */
function itemOk(i: TemplateSetupItem): boolean {
  return i.status !== "error" && i.status !== "invalid";
}

/**
 * Builds the readiness summary for a set of per-template results, splitting the
 * optional marketing template from the core operational ones so a marketing
 * failure never reports the whole setup as failed.
 */
function summarize(items: TemplateSetupItem[]): {
  operationalReady: boolean;
  marketingReady: boolean;
  marketingFailed: boolean;
  success: boolean;
  statusLabel: string;
} {
  const operational = items.filter((i) => isOperationalTemplateName(i.name));
  const marketing = items.filter((i) => !isOperationalTemplateName(i.name));

  const operationalReady = operational.length > 0 && operational.every(itemOk);
  const marketingReady = marketing.length > 0 && marketing.every(itemOk);
  const marketingFailed = marketing.some((i) => !itemOk(i));
  const operationalCreated = operational.filter(itemOk).length;

  // Success = the setup is usable. When operational templates are present, that
  // means at least one operational template made it; a single-template (marketing)
  // retry succeeds on its own outcome.
  const success =
    operational.length > 0 ? operationalCreated > 0 : items.some(itemOk);

  let statusLabel: string;
  if (operational.length === 0) {
    // Single-template run (e.g. a marketing-only retry) — report just that one.
    statusLabel = items.every(itemOk)
      ? "התבנית נשלחה לאישור WhatsApp — ממתין לאישור"
      : "יצירת התבנית נכשלה";
  } else if (operationalReady && marketingReady) {
    statusLabel = "התבניות נשלחו לאישור WhatsApp — ממתין לאישור";
  } else if (operationalReady && marketingFailed) {
    // The exact owner-facing message: operational fine, marketing handled separately.
    statusLabel =
      "WhatsApp מחובר. תבניות תפעוליות נשלחו לאישור. תבנית החזרת לקוחות נכשלה ותטופל בנפרד.";
  } else if (operationalCreated > 0) {
    statusLabel = `נוצרו ${operationalCreated} מתוך ${operational.length} תבניות תפעוליות — חלק נכשלו`;
  } else {
    statusLabel = "WhatsApp מחובר, אך יצירת התבניות נכשלה";
  }

  return { operationalReady, marketingReady, marketingFailed, success, statusLabel };
}

function baseItem(tpl: DefaultTemplate): TemplateSetupItem {
  return {
    label: tpl.label,
    name: tpl.name,
    category: tpl.category,
    language: tpl.language,
    localValid: true,
    status: "unknown",
  };
}

function metaErrorFields(metaError?: SafeMetaTemplateError): {
  errorSubcode?: number;
  fbtraceId?: string;
} {
  return { errorSubcode: metaError?.errorSubcode, fbtraceId: metaError?.fbtraceId };
}

async function storeTemplateOnSetting(
  businessId: string,
  tpl: DefaultTemplate,
  status: TemplateStatus,
): Promise<void> {
  await prisma.automationSetting.upsert({
    where: { businessId_type: { businessId, type: tpl.automationType } },
    create: {
      businessId,
      type: tpl.automationType,
      templateName: tpl.name,
      templateLanguage: tpl.language,
      templateStatus: status,
      templateSyncedAt: new Date(),
    },
    update: {
      templateName: tpl.name,
      templateLanguage: tpl.language,
      templateStatus: status,
      templateSyncedAt: new Date(),
    },
  });
}

/**
 * Option A — create the default templates via the Meta Message Templates API.
 *
 * @param onlyName  When given, creates just that one template (per-row retry).
 */
export async function createDefaultTemplatesForBusiness(
  businessId: string,
  onlyName?: string,
): Promise<TemplateSetupResult> {
  const creds = await getDecryptedCredentialsForBusiness(businessId);
  if (!creds?.wabaId) {
    return {
      success: false,
      statusLabel: "WhatsApp לא מחובר — יש לחבר את WhatsApp לפני יצירת תבניות",
      items: [],
      operationalReady: false,
      marketingReady: false,
      marketingFailed: false,
    };
  }

  const templates = onlyName
    ? DEFAULT_TEMPLATES.filter((t) => t.name === onlyName)
    : DEFAULT_TEMPLATES;

  // For a full-batch run (not an explicit per-row retry), skip templates that are
  // already pending/approved in Meta so we never recreate a live template. A
  // per-row retry (onlyName) always re-attempts, since that's the failed one.
  const existingSettings = onlyName
    ? []
    : ((await prisma.automationSetting.findMany({
        where: {
          businessId,
          type: { in: templates.map((t) => t.automationType) },
        },
        select: { type: true, templateStatus: true },
      })) ?? []);
  const existingStatuses = new Map(
    existingSettings.map((s) => [s.type, s.templateStatus ?? ""]),
  );

  // 1. Validate the whole batch locally — duplicate names are caught here too.
  const validation = new Map(
    validateTemplateBatch(templates).map((v) => [v.name, v.result]),
  );

  const items: TemplateSetupItem[] = [];
  for (const tpl of templates) {
    const item = baseItem(tpl);
    const local = validation.get(tpl.name);

    // Do not recreate a template that is already pending/approved in Meta.
    const existing = existingStatuses.get(tpl.automationType);
    if (!onlyName && (existing === "pending" || existing === "approved")) {
      item.status = existing as TemplateStatus;
      items.push(item);
      continue;
    }

    // 2. Block invalid payloads before they ever reach Meta.
    if (local && !local.ok) {
      item.localValid = false;
      item.status = "invalid";
      item.validationError = local.errors.join(" ");
      item.error = item.validationError;
      items.push(item);
      continue;
    }

    // Dev/admin diagnostics: the exact sanitized payload (no token).
    if (process.env.NODE_ENV !== "production") {
      console.log("[WhatsApp templates] creating", buildSanitizedTemplatePayload(tpl));
    }

    // 3. Create the valid template in Meta.
    const res = await createTemplate(creds.wabaId, creds.accessToken, tpl);
    if (res.ok) {
      const status: TemplateStatus = res.status ?? (res.alreadyExists ? "unknown" : "pending");
      await storeTemplateOnSetting(businessId, tpl, status);
      item.status = status;
      items.push(item);
    } else {
      item.status = "error";
      item.error = res.error;
      Object.assign(item, metaErrorFields(res.metaError));
      items.push(item);
    }
  }

  revalidatePath("/automations");

  const summary = summarize(items);
  return { ...summary, items };
}

/** Masks the middle of an id so logs/UI can show it without leaking the full id. */
function maskId(id: string | undefined): string {
  if (!id) return "(unset)";
  if (id.length <= 8) return id;
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

/** Option B — sync template statuses by reading the WABA's existing templates. */
export async function syncTemplatesForBusiness(
  businessId: string,
): Promise<TemplateSetupResult> {
  const creds = await getDecryptedCredentialsForBusiness(businessId);

  // Common diagnostic header (no token) — available even on the early failures.
  const envWabaIdPresent = creds?.envWabaIdPresent ?? !!process.env.META_WHATSAPP_WABA_ID;

  if (!creds?.wabaId) {
    const diag: SyncDiagnostics = {
      wabaId: undefined,
      wabaIdSource: creds?.wabaIdSource ?? "none",
      envWabaIdPresent,
      phoneNumberId: creds?.phoneNumberId,
      phoneNumberIdSource: creds?.phoneNumberIdSource ?? "none",
      credentialMode: creds?.credentialMode ?? "allura_managed",
      apiVersion: creds?.apiVersion ?? (process.env.META_WHATSAPP_API_VERSION ?? "v19.0"),
      returnedCount: 0,
      returnedTemplates: [],
      expected: DEFAULT_TEMPLATES.map((t) => ({ name: t.name, language: t.language, matched: false })),
      hint: envWabaIdPresent
        ? "ה-WABA ID לא נפתר מהחיבור או מה-env — בדקי את META_WHATSAPP_WABA_ID או את החיבור בבסיס הנתונים."
        : "META_WHATSAPP_WABA_ID לא מוגדר בסביבה (production) — יש להגדירו ב-Vercel.",
    };
    console.warn(
      `[WhatsApp sync] businessId=${businessId} — no WABA id resolved. ` +
        `mode=${diag.credentialMode} envWabaIdPresent=${envWabaIdPresent}`,
    );
    return {
      success: false,
      statusLabel: "WhatsApp לא מחובר — יש לחבר את WhatsApp לפני סנכרון תבניות",
      items: [],
      operationalReady: false,
      marketingReady: false,
      marketingFailed: false,
      syncDiagnostics: diag,
    };
  }

  const list = await listTemplates(creds.wabaId, creds.accessToken);

  // Build the per-template match info up front (also used to construct the hint).
  const returnedTemplates = (list.templates ?? []).map((t) => ({
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    rawStatus: t.rawStatus,
  }));
  const expected = DEFAULT_TEMPLATES.map((tpl) => ({
    name: tpl.name,
    language: tpl.language,
    matched: (list.templates ?? []).some(
      (t) => t.name === tpl.name && t.language === tpl.language,
    ),
  }));

  const baseDiag = {
    wabaId: creds.wabaId,
    wabaIdSource: creds.wabaIdSource,
    envWabaIdPresent,
    phoneNumberId: creds.phoneNumberId,
    phoneNumberIdSource: creds.phoneNumberIdSource,
    credentialMode: creds.credentialMode,
    apiVersion: creds.apiVersion,
    returnedCount: returnedTemplates.length,
    returnedTemplates,
    expected,
  };

  // Server log: safe, token-free. WABA id is masked in logs; the full id is only
  // returned to the admin UI (it is not a secret, but logs are shared more widely).
  console.info(
    `[WhatsApp sync] businessId=${businessId} ` +
      `waba=${maskId(creds.wabaId)} wabaSource=${creds.wabaIdSource} ` +
      `phone=${maskId(creds.phoneNumberId)} phoneSource=${creds.phoneNumberIdSource} ` +
      `mode=${creds.credentialMode} apiVersion=${creds.apiVersion} ` +
      `listOk=${list.ok} returnedCount=${returnedTemplates.length} ` +
      `returned=[${returnedTemplates.map((t) => `${t.name}/${t.language}/${t.rawStatus ?? t.status}`).join(", ")}] ` +
      `matched=[${expected.filter((e) => e.matched).map((e) => e.name).join(", ")}]` +
      (list.ok ? "" : ` listError="${list.error}" httpStatus=${list.httpStatus} code=${list.errorCode} type=${list.errorType}`),
  );

  if (!list.ok || !list.templates) {
    // listTemplates failed outright — almost always token/permission/WABA, not a
    // name mismatch. Codes: 190 = bad token, 200/10 = missing permission, 100 =
    // bad WABA id / object.
    const code = list.errorCode;
    const hint =
      code === 190
        ? "ה-Access Token לא תקין או פג תוקף (code 190) — חדשי את META_WHATSAPP_ACCESS_TOKEN."
        : code === 200 || code === 10
          ? "לטוקן חסרה הרשאת whatsapp_business_management (code 200) — הוסיפי את ההרשאה ל-System User token."
          : code === 100
            ? "ה-WABA ID כנראה שגוי או לא נגיש לטוקן (code 100) — ודאי שזה ה-WABA הנכון."
            : `קריאת רשימת התבניות נכשלה — ${list.error ?? "שגיאה לא ידועה"}.`;
    const diag: SyncDiagnostics = {
      ...baseDiag,
      listError: list.error,
      listHttpStatus: list.httpStatus,
      listErrorCode: list.errorCode,
      listErrorType: list.errorType,
      hint,
    };
    return {
      success: false,
      statusLabel: list.error ? `סנכרון נכשל — ${list.error}` : "סנכרון נכשל",
      items: [],
      operationalReady: false,
      marketingReady: false,
      marketingFailed: false,
      syncDiagnostics: diag,
    };
  }

  const items: TemplateSetupItem[] = [];
  let matched = 0;
  for (const tpl of DEFAULT_TEMPLATES) {
    const item = baseItem(tpl);
    const found = list.templates.find(
      (t) => t.name === tpl.name && t.language === tpl.language,
    );
    if (found) {
      matched++;
      await storeTemplateOnSetting(businessId, tpl, found.status);
      item.status = found.status;
      items.push(item);
    } else {
      item.status = "error";
      // Distinguish "name exists but language differs" from "name absent entirely".
      const sameName = list.templates.filter((t) => t.name === tpl.name);
      item.error = sameName.length
        ? `נמצאה תבנית בשם זה אך בשפה ${sameName.map((t) => t.language).join("/")} (מצפים ל-${tpl.language})`
        : "לא נמצאה תבנית";
      items.push(item);
    }
  }

  // Interpret the result for the admin.
  const hint =
    returnedTemplates.length === 0
      ? `Meta החזירה 0 תבניות עבור ה-WABA הזה — כמעט תמיד זה ה-WABA הלא נכון (התבניות נוצרו ב-WABA אחר) או שלטוקן חסרה הרשאת whatsapp_business_management. ודאי שה-WABA ID (מקור: ${creds.wabaIdSource}) הוא אותו WABA שבו נוצרו התבניות ב-WhatsApp Manager.`
      : matched === DEFAULT_TEMPLATES.length
        ? "כל התבניות נמצאו והותאמו בהצלחה."
        : matched > 0
          ? "חלק מהתבניות הותאמו — לשאר יש אי-התאמה בשם או בשפה (ראי הרשימה שהוחזרה)."
          : "Meta החזירה תבניות, אך אף אחת מהן לא תואמת בשם+שפה לתבניות הצפויות — השוואת השמות/שפות מול הרשימה שהוחזרה תראה את ההבדל.";

  const diag: SyncDiagnostics = { ...baseDiag, hint };

  revalidatePath("/automations");

  const summary = summarize(items);
  return {
    success: matched > 0,
    statusLabel:
      matched === DEFAULT_TEMPLATES.length
        ? "כל התבניות סונכרנו בהצלחה"
        : matched > 0
          ? `סונכרנו ${matched} מתוך ${DEFAULT_TEMPLATES.length} תבניות`
          : "לא נמצאו תבניות תואמות — ודאי שהן נוצרו ב-WhatsApp",
    items,
    operationalReady: summary.operationalReady,
    marketingReady: summary.marketingReady,
    marketingFailed: summary.marketingFailed,
    syncDiagnostics: diag,
  };
}
