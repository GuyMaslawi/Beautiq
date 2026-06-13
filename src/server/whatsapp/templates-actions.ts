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

// NOTE: A "use server" module may only export async functions. Re-exporting a
// type with `export type { ... }` here makes the server-action transform emit a
// runtime reference to a type-only binding, which throws
// "ReferenceError: TemplateSetupResult is not defined" at module-eval and breaks
// EVERY server action bundled for the page (including sign-out). Consumers import
// this type directly from `templates-core` instead.

export async function createDefaultTemplatesAction(): Promise<TemplateSetupResult> {
  const business = await requireCurrentBusiness();
  return createDefaultTemplatesForBusiness(business.id);
}

export async function syncTemplatesAction(): Promise<TemplateSetupResult> {
  const business = await requireCurrentBusiness();
  return syncTemplatesForBusiness(business.id);
}
