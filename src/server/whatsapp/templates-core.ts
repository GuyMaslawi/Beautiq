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

export interface TemplateSetupResult {
  success: boolean;
  /** Owner-facing Hebrew summary. */
  statusLabel: string;
  /** Per-template outcome for admin diagnostics. */
  items: TemplateSetupItem[];
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

  const created = items.filter((i) => i.status !== "error" && i.status !== "invalid").length;
  const total = items.length;
  return {
    success: created > 0,
    statusLabel:
      created === total
        ? "התבניות נשלחו לאישור WhatsApp — ממתין לאישור"
        : created > 0
          ? `נוצרו ${created} מתוך ${total} תבניות — חלק נכשלו`
          : "WhatsApp מחובר, אך יצירת התבניות נכשלה",
    items,
  };
}

/** Option B — sync template statuses by reading the WABA's existing templates. */
export async function syncTemplatesForBusiness(
  businessId: string,
): Promise<TemplateSetupResult> {
  const creds = await getDecryptedCredentialsForBusiness(businessId);
  if (!creds?.wabaId) {
    return {
      success: false,
      statusLabel: "WhatsApp לא מחובר — יש לחבר את WhatsApp לפני סנכרון תבניות",
      items: [],
    };
  }

  const list = await listTemplates(creds.wabaId, creds.accessToken);
  if (!list.ok || !list.templates) {
    return {
      success: false,
      statusLabel: list.error ? `סנכרון נכשל — ${list.error}` : "סנכרון נכשל",
      items: [],
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
      item.error = "לא נמצאה תבנית";
      items.push(item);
    }
  }

  revalidatePath("/automations");

  return {
    success: matched > 0,
    statusLabel:
      matched === DEFAULT_TEMPLATES.length
        ? "כל התבניות סונכרנו בהצלחה"
        : matched > 0
          ? `סונכרנו ${matched} מתוך ${DEFAULT_TEMPLATES.length} תבניות`
          : "לא נמצאו תבניות תואמות — ודאי שהן נוצרו ב-WhatsApp",
    items,
  };
}
