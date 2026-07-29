"use server";

import { requirePaidUser, getCurrentBusiness, hasPlatinumAccess } from "@/server/auth/session";
import { getAssistantContext } from "@/server/assistant/queries";
import { captureError } from "@/lib/logger";
import type { AssistantContext } from "@/lib/assistant/engine";

export type AssistantContextResult =
  | { ok: true; context: AssistantContext }
  | { ok: false; reason: "locked" | "no-business" | "error" };

/**
 * Lazily loads the assistant context for the floating chat widget. Called only
 * when the owner opens the chat, so the (moderately heavy) aggregation query
 * doesn't run on every page load.
 *
 * Platinum-gated: admins always pass, otherwise the user must be on platinum
 * (see [[project_subscribe_paywall]] / hasPlatinumAccess). Business-scoped.
 *
 * SECURITY: requirePaidUser() runs first, exactly like requireCurrentBusiness()
 * does for every other action. hasPlatinumAccess() alone checks only the plan —
 * it says nothing about suspension, so an account an admin suspended for abuse
 * kept pulling its full business dossier (today's schedule, revenue, at-risk
 * clients) by POSTing this action id straight from the client bundle, long after
 * the app shell had stopped rendering for it.
 */
export async function loadAssistantContextAction(): Promise<AssistantContextResult> {
  await requirePaidUser();
  if (!(await hasPlatinumAccess())) return { ok: false, reason: "locked" };

  const business = await getCurrentBusiness();
  if (!business) return { ok: false, reason: "no-business" };

  try {
    const context = await getAssistantContext({ businessId: business.id }, business.name);
    return { ok: true, context };
  } catch (err) {
    // Never let the aggregation throw across the server-action boundary — that
    // rejects the promise on the client and leaves the widget spinning forever.
    captureError("assistant.loadContext", err, { businessId: business.id });
    return { ok: false, reason: "error" };
  }
}
