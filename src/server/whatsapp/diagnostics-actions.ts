"use server";

/**
 * Admin-only server actions for the WhatsApp diagnostics panel.
 *
 *   - runWhatsAppDryRunAction: pure eligibility check, NEVER sends.
 *   - runWhatsAppTestSendAction: a single controlled test send to the configured
 *     test phone, via the existing safe review-demo path (re-checks every guard,
 *     logs an AutomationRun + AutomationMessage, never fakes a send).
 *
 * Both are gated to platform admins and scoped to the caller's current business.
 * Never returns tokens or credentials.
 */

import { requireCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import {
  evaluateWhatsAppSend,
  type DiagnosticMessageType,
  type WhatsAppSendEvaluation,
} from "./diagnostics";
import { sendReviewDemoTestMessage } from "./review-demo";

export interface DryRunActionResult {
  ok: boolean;
  /** Hebrew error when the action itself could not run (e.g. not admin). */
  error?: string;
  evaluation?: WhatsAppSendEvaluation;
}

export async function runWhatsAppDryRunAction(input: {
  messageType: DiagnosticMessageType;
  clientId?: string;
}): Promise<DryRunActionResult> {
  const [business, user] = await Promise.all([requireCurrentBusiness(), getCurrentUser()]);
  if (!user?.isAdmin) {
    return { ok: false, error: "פעולה זו זמינה למנהלי מערכת בלבד." };
  }

  const evaluation = await evaluateWhatsAppSend({
    businessId: business.id,
    messageType: input.messageType,
    clientId: input.clientId || undefined,
  });

  return { ok: true, evaluation };
}

export interface TestSendActionResult {
  ok: boolean;
  /** Hebrew error/status to display. */
  message: string;
  /** True only when a real message was actually sent. */
  sent: boolean;
  status?: "sent" | "failed" | "skipped";
  runId?: string;
}

/**
 * Sends exactly one controlled test message to WHATSAPP_TEST_PHONE through the
 * guarded review-demo path. Refuses (never fakes) when any guard fails.
 */
export async function runWhatsAppTestSendAction(): Promise<TestSendActionResult> {
  const [business, user] = await Promise.all([requireCurrentBusiness(), getCurrentUser()]);
  if (!user?.isAdmin) {
    return { ok: false, sent: false, message: "פעולה זו זמינה למנהלי מערכת בלבד." };
  }

  const result = await sendReviewDemoTestMessage(business.id);

  if (result.success) {
    return {
      ok: true,
      sent: true,
      status: result.status,
      runId: result.runId,
      message: "הודעת בדיקה נשלחה למספר הבדיקה. בדקי את המכשיר שמחובר למספר הבדיקה.",
    };
  }

  return {
    ok: true,
    sent: false,
    status: result.status,
    runId: result.runId,
    message: result.reason ?? "שליחת הבדיקה לא בוצעה.",
  };
}
