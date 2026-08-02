"use server";

import { requirePaidUser, getCurrentBusiness } from "@/server/auth/session";
import { getAssistantContext } from "@/server/assistant/queries";
import { captureError } from "@/lib/logger";
import type { AssistantContext } from "@/lib/assistant/engine";

export type AssistantContextResult =
  | { ok: true; context: AssistantContext }
  | { ok: false; reason: "no-business" | "error" };

/**
 * Lazily loads the assistant context for the floating chat widget. Called only
 * when the owner opens the chat, so the (moderately heavy) aggregation query
 * doesn't run on every page load.
 *
 * SECURITY: requirePaidUser() runs first, exactly like requireCurrentBusiness()
 * does for every other action — it covers both the paywall and suspension. An
 * account an admin suspended for abuse must not keep pulling its full business
 * dossier (today's schedule, revenue, at-risk clients) by POSTing this action id
 * straight from the client bundle, long after the app shell stopped rendering
 * for it.
 */
export async function loadAssistantContextAction(): Promise<AssistantContextResult> {
  await requirePaidUser();

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
