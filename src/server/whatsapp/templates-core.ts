/**
 * Template setup core — businessId-parameterized, no auth.
 *
 * Shared by the owner actions (templates-actions.ts, scoped to the current
 * business) and the admin actions (whatsapp-actions.ts, scoped to an explicit
 * businessId). Auth is enforced by the callers, never here.
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
  type TemplateStatus,
} from "@/lib/whatsapp/meta-templates-api";

export interface TemplateSetupResult {
  success: boolean;
  /** Owner-facing Hebrew summary. */
  statusLabel: string;
  /** Per-template outcome for admin diagnostics. */
  items: Array<{
    label: string;
    name: string;
    status: TemplateStatus | "error";
    error?: string;
  }>;
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

/** Option A — create the 4 default templates via the Meta Message Templates API. */
export async function createDefaultTemplatesForBusiness(
  businessId: string,
): Promise<TemplateSetupResult> {
  const creds = await getDecryptedCredentialsForBusiness(businessId);
  if (!creds?.wabaId) {
    return {
      success: false,
      statusLabel: "WhatsApp לא מחובר — יש לחבר את WhatsApp לפני יצירת תבניות",
      items: [],
    };
  }

  const items: TemplateSetupResult["items"] = [];
  for (const tpl of DEFAULT_TEMPLATES) {
    const res = await createTemplate(creds.wabaId, creds.accessToken, tpl);
    if (res.ok) {
      const status: TemplateStatus = res.status ?? (res.alreadyExists ? "unknown" : "pending");
      await storeTemplateOnSetting(businessId, tpl, status);
      items.push({ label: tpl.label, name: tpl.name, status });
    } else {
      items.push({ label: tpl.label, name: tpl.name, status: "error", error: res.error });
    }
  }

  revalidatePath("/automations");

  const created = items.filter((i) => i.status !== "error").length;
  return {
    success: created > 0,
    statusLabel:
      created === DEFAULT_TEMPLATES.length
        ? "התבניות נשלחו לאישור WhatsApp — ממתין לאישור"
        : created > 0
          ? `נוצרו ${created} מתוך ${DEFAULT_TEMPLATES.length} תבניות`
          : "יצירת התבניות נכשלה",
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

  const items: TemplateSetupResult["items"] = [];
  let matched = 0;
  for (const tpl of DEFAULT_TEMPLATES) {
    const found = list.templates.find(
      (t) => t.name === tpl.name && t.language === tpl.language,
    );
    if (found) {
      matched++;
      await storeTemplateOnSetting(businessId, tpl, found.status);
      items.push({ label: tpl.label, name: tpl.name, status: found.status });
    } else {
      items.push({ label: tpl.label, name: tpl.name, status: "error", error: "לא נמצאה תבנית" });
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
