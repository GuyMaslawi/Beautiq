"use server";

/**
 * WhatsApp template setup — owner actions (scoped to the current business).
 *
 *   createDefaultTemplatesAction  — Option A: create the 4 default templates in
 *                                   the connected business's WABA via Meta API.
 *   syncTemplatesAction           — Option B: read existing templates and store
 *                                   matching statuses on AutomationSetting.
 *
 * The owner never sees technical template names — only "מוכן לשליחה" /
 * "ממתין לאישור" style labels. Auth is enforced via requireCurrentBusiness.
 */

import { requireCurrentBusiness } from "@/server/auth/session";
import {
  createDefaultTemplatesForBusiness,
  syncTemplatesForBusiness,
  type TemplateSetupResult,
} from "@/server/whatsapp/templates-core";

export type { TemplateSetupResult };

export async function createDefaultTemplatesAction(): Promise<TemplateSetupResult> {
  const business = await requireCurrentBusiness();
  return createDefaultTemplatesForBusiness(business.id);
}

export async function syncTemplatesAction(): Promise<TemplateSetupResult> {
  const business = await requireCurrentBusiness();
  return syncTemplatesForBusiness(business.id);
}
