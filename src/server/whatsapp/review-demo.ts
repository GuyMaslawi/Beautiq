/**
 * Meta App Review demo mode.
 *
 * A safe, honest, business-scoped status + a single guarded test-send used only
 * for a controlled Meta App Review demo:
 *
 *   - getReviewDemoStatus()  → owner-safe checklist of every real-send guard.
 *       NEVER exposes tokens, template names, WABA/phone-number ids, or the raw
 *       test recipient (the test phone is masked).
 *
 *   - sendReviewDemoTestMessage() → sends exactly ONE approved template message
 *       to the configured test recipient, and ONLY when every guard passes:
 *         ENABLE_REAL_WHATSAPP_SEND=true
 *         WHATSAPP_PROVIDER=meta_cloud_api
 *         active per-business WhatsAppConnection
 *         WHATSAPP_TEST_PHONE configured
 *         at least one approved/usable template
 *       It records an AutomationRun + AutomationMessage (audit trail) and returns
 *       the provider message id / status. It never fakes a send and never logs
 *       secrets.
 *
 * In WHATSAPP_TEST_MODE the test recipient IS WHATSAPP_TEST_PHONE, so the send is
 * allowed by the test-mode guard; with test mode off the real provider sends
 * directly to the same number. Either way only the configured test number is ever
 * messaged.
 */

import { prisma } from "@/server/db/prisma";
import {
  getWhatsAppReadiness,
  getWhatsAppProviderForBusiness,
  resolveWhatsAppConnectionForBusiness,
} from "@/server/whatsapp/resolver";
import { getDefaultTemplateForType } from "@/lib/whatsapp/default-templates";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import type { AutomationType } from "@prisma/client";

export type ReviewDemoState = "not_connected" | "connected_disabled" | "ready";

export interface ReviewDemoCheck {
  label: string;
  ok: boolean;
  /** Owner-safe value — never a token, raw phone, or template name. */
  value?: string;
}

export interface ReviewDemoStatus {
  /** True only when a single approved test message can actually be sent. */
  canTestSend: boolean;
  /** Drives the reviewer-facing copy. */
  state: ReviewDemoState;
  /** Reviewer-facing Hebrew copy for the current state. */
  message: string;
  /** Hebrew reason the test send is blocked (when canTestSend=false). */
  blockReason?: string;
  /** Owner-safe display phone (the business's own number), if connected. */
  displayPhoneNumber?: string;
  /** Per-guard checklist for the review panel. */
  checks: ReviewDemoCheck[];
}

export interface ReviewDemoSendResult {
  success: boolean;
  /** True when the send was refused by the guards (never attempted). */
  blocked?: boolean;
  /** Provider-assigned message id, when sent. */
  providerMessageId?: string | null;
  /** Persisted status of the logged message (sent | failed | skipped). */
  status?: "sent" | "failed" | "skipped";
  /** Owner-safe Hebrew reason on failure/block — never a credential. */
  reason?: string;
  /** Id of the AutomationRun created for the audit trail. */
  runId?: string;
}

const COPY: Record<ReviewDemoState, string> = {
  not_connected:
    "כדי לשלוח הודעת WhatsApp אמיתית, יש להשלים קודם את חיבור Meta Embedded Signup.",
  connected_disabled:
    "החיבור קיים, אך שליחה אמיתית כבויה עד להפעלת משתני הסביבה המתאימים.",
  ready: "ניתן לשלוח הודעת בדיקה למספר שהוגדר לצורך סקירת Meta.",
};

/** Masks the test recipient so the panel never prints the raw number. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Server-only. Finds an approved, usable template for the demo send.
 * Returns the technical template details — NEVER pass this to the client.
 */
async function resolveApprovedDemoTemplate(businessId: string): Promise<{
  templateName: string;
  templateLanguage: string;
  automationType: AutomationType;
} | null> {
  const settings = await prisma.automationSetting.findMany({
    where: { businessId },
    select: {
      type: true,
      templateName: true,
      templateStatus: true,
      templateLanguage: true,
    },
  });

  const approved = settings.find(
    (s) => s.templateStatus === "approved" && !!s.templateName,
  );
  if (!approved?.templateName) return null;

  return {
    templateName: approved.templateName,
    templateLanguage: approved.templateLanguage ?? "he",
    automationType: approved.type,
  };
}

/**
 * Business-scoped review-demo status. Combines every real-send guard into an
 * owner-safe checklist. Never reads or returns tokens.
 */
export async function getReviewDemoStatus(
  businessId: string,
): Promise<ReviewDemoStatus> {
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  const providerIsMetaCloud = process.env.WHATSAPP_PROVIDER === "meta_cloud_api";
  const testMode = process.env.WHATSAPP_TEST_MODE === "true";
  const testPhone = process.env.WHATSAPP_TEST_PHONE;
  const testRecipientConfigured = !!testPhone;

  const [readiness, resolved, approvedTemplate, sampleClient] = await Promise.all([
    getWhatsAppReadiness(businessId),
    resolveWhatsAppConnectionForBusiness(businessId),
    resolveApprovedDemoTemplate(businessId),
    prisma.client.findFirst({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  // In the Allura-managed model no per-business WhatsAppConnection row is ever
  // created, so readiness alone reports "not connected". A resolved managed mode
  // already implies the kill-switch is on and global creds exist — treat it as a
  // valid, active connection so the demo test-send isn't falsely blocked.
  const isManaged = resolved.mode === "allura_managed";
  const hasActiveConnection = readiness.state === "active" || isManaged;
  const connectionStatusLabel = isManaged
    ? "מחובר (ניהול Allura)"
    : readiness.statusLabel;
  const templatesApproved = !!approvedTemplate;
  const hasSampleClient = !!sampleClient;

  const checks: ReviewDemoCheck[] = [
    {
      label: "שליחה אמיתית מופעלת (ENABLE_REAL_WHATSAPP_SEND)",
      ok: realSendEnabled,
    },
    {
      label: "ספק מוגדר ל-meta_cloud_api (WHATSAPP_PROVIDER)",
      ok: providerIsMetaCloud,
    },
    {
      label: "חיבור WhatsApp פעיל לעסק",
      ok: hasActiveConnection,
      value: connectionStatusLabel,
    },
    {
      label: "תבנית הודעה מאושרת זמינה",
      ok: templatesApproved,
    },
    {
      label: "מספר נמען לבדיקה מוגדר (WHATSAPP_TEST_PHONE)",
      ok: testRecipientConfigured,
      value: testRecipientConfigured ? maskPhone(testPhone!) : "לא מוגדר",
    },
    {
      label: "מצב בדיקה (WHATSAPP_TEST_MODE)",
      ok: true,
      value: testMode ? "פעיל — שליחה רק למספר הבדיקה" : "כבוי",
    },
    {
      label: "לקוח לדוגמה לרישום הבדיקה",
      ok: hasSampleClient,
    },
  ];

  const canTestSend =
    realSendEnabled &&
    providerIsMetaCloud &&
    hasActiveConnection &&
    testRecipientConfigured &&
    templatesApproved &&
    hasSampleClient;

  let state: ReviewDemoState;
  let blockReason: string | undefined;

  if (!hasActiveConnection) {
    state = "not_connected";
    blockReason = "חיבור WhatsApp עדיין לא הושלם.";
  } else if (canTestSend) {
    state = "ready";
  } else {
    state = "connected_disabled";
    if (!realSendEnabled) blockReason = "שליחה אמיתית כבויה (ENABLE_REAL_WHATSAPP_SEND).";
    else if (!providerIsMetaCloud) blockReason = "הספק אינו מוגדר ל-meta_cloud_api.";
    else if (!testRecipientConfigured) blockReason = "מספר נמען לבדיקה לא מוגדר.";
    else if (!templatesApproved) blockReason = "אין תבנית הודעה מאושרת לשליחה.";
    else if (!hasSampleClient) blockReason = "אין לקוח לדוגמה בעסק לרישום הבדיקה.";
  }

  return {
    canTestSend,
    state,
    message: COPY[state],
    blockReason,
    displayPhoneNumber: readiness.displayPhoneNumber,
    checks,
  };
}

/**
 * Sends exactly one approved template message to the configured test recipient,
 * for a controlled Meta App Review demo. Re-checks every guard server-side and
 * refuses (blocked=true) if any fails — it never fakes a send.
 *
 * Records an AutomationRun + AutomationMessage (type "manual", source
 * "review_demo") and returns the provider message id / status. Never logs secrets.
 */
export async function sendReviewDemoTestMessage(
  businessId: string,
): Promise<ReviewDemoSendResult> {
  const status = await getReviewDemoStatus(businessId);
  if (!status.canTestSend) {
    return {
      success: false,
      blocked: true,
      reason: status.blockReason ?? "שליחת בדיקה אינה זמינה כעת.",
    };
  }

  const testPhone = process.env.WHATSAPP_TEST_PHONE!;
  const template = await resolveApprovedDemoTemplate(businessId);
  if (!template) {
    return { success: false, blocked: true, reason: "אין תבנית הודעה מאושרת לשליחה." };
  }

  // Anchor the audit row to a real sample client (FK requirement). The message
  // is still sent to the configured TEST recipient, not to this client.
  const client = await prisma.client.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!client) {
    return { success: false, blocked: true, reason: "אין לקוח לדוגמה בעסק לרישום הבדיקה." };
  }

  const messageText =
    "הודעת בדיקה לסקירת Meta — נשלחה אל מספר הבדיקה שהוגדר.";

  const run = await prisma.automationRun.create({
    data: {
      businessId,
      type: "manual",
      status: "running",
      eligibleCount: 1,
    },
  });

  const message = await prisma.automationMessage.create({
    data: {
      businessId,
      runId: run.id,
      clientId: client.id,
      type: "manual",
      phone: testPhone,
      messageText,
      templateId: template.templateName,
      status: "queued",
      source: "review_demo",
    },
  });

  // hello_world is Meta's zero-variable sandbox template. For our real templates,
  // the approval example values always match the template's variable count, so
  // they are the safest payload for a demo send.
  const defaultTemplate = getDefaultTemplateForType(template.automationType);
  const templateVariables =
    template.templateName === "hello_world" || !defaultTemplate?.example?.length
      ? undefined
      : Object.fromEntries(
          defaultTemplate.example.map((value, i) => [String(i + 1), value]),
        );

  const provider = await getWhatsAppProviderForBusiness(businessId);
  const result = await provider.send({
    businessId,
    toPhone: testPhone,
    templateId: template.templateName,
    templateLanguage: template.templateLanguage,
    templateVariables,
    fallbackText: messageText,
    automationRunId: run.id,
    clientId: client.id,
  });

  let persistedStatus: "sent" | "failed" | "skipped";
  if (result.isMockSkip) {
    persistedStatus = "skipped";
    await prisma.automationMessage.update({
      where: { id: message.id },
      data: { status: "skipped", failureReason: DEV_MOCK_SKIP_REASON },
    });
  } else if (result.isTestModeBlock) {
    persistedStatus = "skipped";
    await prisma.automationMessage.update({
      where: { id: message.id },
      data: { status: "skipped", failureReason: TEST_MODE_BLOCKED_REASON },
    });
  } else if (result.success) {
    persistedStatus = "sent";
    await prisma.automationMessage.update({
      where: { id: message.id },
      data: {
        status: "sent",
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      },
    });
  } else {
    persistedStatus = "failed";
    await prisma.automationMessage.update({
      where: { id: message.id },
      data: { status: "failed", failureReason: result.failureReason },
    });
  }

  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: persistedStatus === "failed" ? "failed" : "completed",
      finishedAt: new Date(),
      sentCount: persistedStatus === "sent" ? 1 : 0,
      failedCount: persistedStatus === "failed" ? 1 : 0,
      skippedCount: persistedStatus === "skipped" ? 1 : 0,
    },
  });

  console.log(
    `[review-demo] test send — businessId=${businessId} runId=${run.id} status=${persistedStatus}`,
  );

  return {
    success: result.success,
    providerMessageId: result.providerMessageId,
    status: persistedStatus,
    reason: result.success ? undefined : result.failureReason,
    runId: run.id,
  };
}
