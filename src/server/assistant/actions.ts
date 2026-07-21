"use server";

import { getCurrentBusiness, hasPlatinumAccess } from "@/server/auth/session";
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
 */
export async function loadAssistantContextAction(): Promise<AssistantContextResult> {
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
