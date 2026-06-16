/**
 * WhatsApp send diagnostics — dry-run eligibility engine.
 *
 * {@link evaluateWhatsAppSend} answers, WITHOUT sending anything, exactly why a
 * given message type (optionally for a specific client) would or would not be
 * delivered. It mirrors the real guard chain in the send pipeline so the admin
 * panel never has to guess: every "message not sent" maps to one stable reason
 * code (see reasons.ts).
 *
 * SAFETY: read-only. Never sends, never returns tokens/credentials. The test
 * phone is masked. Business-scoped — clients are always loaded by businessId.
 */

import { prisma } from "@/server/db/prisma";
import { resolveWhatsAppConnectionForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone, phonesEqual } from "@/lib/phone";
import { whatsAppReasonLabel, type WhatsAppSendReason } from "./reasons";
import type { AutomationType } from "@prisma/client";

/** Message types the diagnostics panel can evaluate. */
export type DiagnosticMessageType =
  | "booking_confirmation"
  | "morning_reminder"
  | "review_request"
  | "win_back"
  | "manual";

/** Hebrew labels for the message-type picker. */
export const DIAGNOSTIC_MESSAGE_TYPE_LABELS: Record<DiagnosticMessageType, string> = {
  booking_confirmation: "אישור תור",
  morning_reminder: "תזכורת לפני תור",
  review_request: "בקשת ביקורת",
  win_back: "החזרת לקוחות",
  manual: "הודעת בדיקה",
};

/** Marketing message types require an explicit marketing opt-in. */
const MARKETING_TYPES: ReadonlySet<DiagnosticMessageType> = new Set(["win_back"]);

/** How each type is triggered — surfaced so owners know when a message fires. */
const TRIGGER_DETAIL: Record<DiagnosticMessageType, string> = {
  booking_confirmation: "מיידי — כשנקבע או מאושר תור",
  morning_reminder: "מתוזמן — הרצת cron יומית",
  review_request: "מתוזמן — cron אחרי סיום הטיפול",
  win_back: "מתוזמן — cron / הרצה ידנית",
  manual: "ידני — שליחת הודעת בדיקה",
};

export interface DiagnosticCheck {
  key: string;
  label: string;
  ok: boolean;
  /** Stable reason code when this check is the blocker. */
  code?: WhatsAppSendReason;
  /** Owner/admin-safe extra detail — never a secret. */
  detail?: string;
}

export interface WhatsAppSendEvaluation {
  messageType: DiagnosticMessageType;
  messageTypeLabel: string;
  /** True only when every required guard passes — a real send would go out. */
  wouldSend: boolean;
  /** First failing guard, when wouldSend=false. */
  blockReason?: { code: WhatsAppSendReason; label: string };
  checks: DiagnosticCheck[];
  /** Owner-safe context. */
  context: {
    realSendEnabled: boolean;
    testMode: boolean;
    testPhoneMasked?: string;
    providerName: string;
    connectionStatusLabel: string;
    displayPhoneNumber?: string;
    clientSelected: boolean;
  };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Returns a small list of recent clients for the diagnostics client picker.
 * Business-scoped; the label includes only the name and the last 4 phone digits.
 */
export async function getDiagnosticClientOptions(
  businessId: string,
  limit = 50,
): Promise<Array<{ id: string; label: string }>> {
  const clients = await prisma.client.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, fullName: true, phone: true },
  });
  return clients.map((c) => ({
    id: c.id,
    label: `${c.fullName} · ${maskPhone(c.phone)}`,
  }));
}

/** Maps a diagnostic message type to the AutomationSetting/template type it uses. */
function settingTypeFor(type: DiagnosticMessageType): AutomationType | null {
  if (type === "manual") return null; // manual/test reuses any approved template
  return type as AutomationType;
}

/**
 * Pure, read-only evaluation of whether a WhatsApp message of `messageType`
 * would be delivered for `businessId` (and `clientId`, when given).
 */
export async function evaluateWhatsAppSend(params: {
  businessId: string;
  messageType: DiagnosticMessageType;
  clientId?: string;
}): Promise<WhatsAppSendEvaluation> {
  const { businessId, messageType, clientId } = params;

  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  const testMode = process.env.WHATSAPP_TEST_MODE === "true";
  const testPhone = process.env.WHATSAPP_TEST_PHONE;

  const resolved = await resolveWhatsAppConnectionForBusiness(businessId);
  // Transport is usable only when the resolver returns the real Meta provider
  // (possibly wrapped by the test-mode guard). dev_mock / disabled never deliver.
  const connectionOk = resolved.provider.name.includes("meta_cloud_api");

  // --- Template readiness ---
  const settingType = settingTypeFor(messageType);
  let templateName: string | null = null;
  let templateStatus: string | null = null;
  let requireOptIn: boolean;

  if (settingType) {
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: settingType } },
      select: { templateName: true, templateStatus: true, requireOptIn: true },
    });
    templateName = setting?.templateName ?? null;
    templateStatus = setting?.templateStatus ?? null;
    // Booking confirmation is transactional — opt-in defaults to false when unset.
    requireOptIn = setting?.requireOptIn ?? (messageType === "booking_confirmation" ? false : true);
  } else {
    // manual/test: any approved template qualifies.
    const settings = await prisma.automationSetting.findMany({
      where: { businessId },
      select: { templateName: true, templateStatus: true },
    });
    const approved = settings.find((s) => s.templateStatus === "approved" && !!s.templateName);
    templateName = approved?.templateName ?? null;
    templateStatus = approved ? "approved" : null;
    requireOptIn = false;
  }

  const templateApproved = !!templateName && templateStatus === "approved";

  // --- Client (optional) ---
  const client = clientId
    ? await prisma.client.findFirst({
        where: { id: clientId, businessId },
        select: {
          phone: true,
          normalizedPhone: true,
          unsubscribedAt: true,
          whatsappOptIn: true,
          marketingOptIn: true,
        },
      })
    : null;

  const checks: DiagnosticCheck[] = [];

  // 1. Real send enabled
  checks.push({
    key: "real_send",
    label: "שליחה אמיתית מופעלת",
    ok: realSendEnabled,
    code: "real_send_disabled",
    detail: realSendEnabled ? undefined : whatsAppReasonLabel("dev_mode"),
  });

  // 2. Active connection / provider
  checks.push({
    key: "connection",
    label: "חיבור WhatsApp פעיל וספק שליחה תקין",
    ok: connectionOk,
    code: "missing_connection",
    detail: resolved.uiStatus,
  });

  // 3. Connected number present
  checks.push({
    key: "number",
    label: "מספר WhatsApp מחובר",
    ok: !!resolved.phoneNumberId,
    code: "missing_connection",
    detail: resolved.displayPhoneNumber,
  });

  // 4. Template exists and approved (only enforced for real sends)
  {
    const templateRequired = realSendEnabled;
    let ok = true;
    let code: WhatsAppSendReason | undefined;
    if (templateRequired) {
      if (!templateName) {
        ok = false;
        code = "missing_template";
      } else if (!templateApproved) {
        ok = false;
        code = "template_not_approved";
      }
    }
    checks.push({
      key: "template",
      label: "תבנית קיימת ומאושרת",
      ok,
      code,
      detail: templateName
        ? `סטטוס: ${templateStatus ?? "לא ידוע"}`
        : "לא הוגדרה תבנית מאושרת",
    });
  }

  // 5. Test mode / test phone configured
  checks.push({
    key: "test_mode",
    label: "מצב בדיקה ומספר בדיקה",
    ok: !testMode || !!testPhone,
    code: "test_phone_not_set",
    detail: testMode
      ? testPhone
        ? `פעיל — שליחה רק ל-${maskPhone(testPhone)}`
        : "פעיל — מספר בדיקה לא הוגדר"
      : "כבוי",
  });

  // --- Client-specific checks (only when a client is selected) ---
  if (clientId) {
    const clientPhone = client?.phone ?? "";

    checks.push({
      key: "phone",
      label: "טלפון לקוחה תקין",
      ok: !!client && isValidIsraeliPhone(clientPhone),
      code: "invalid_phone",
    });

    checks.push({
      key: "unsubscribed",
      label: "הלקוחה לא הסירה את עצמה",
      ok: !!client && !client.unsubscribedAt,
      code: "unsubscribed",
    });

    checks.push({
      key: "opt_in",
      label: requireOptIn ? "הלקוחה אישרה קבלת הודעות WhatsApp" : "אישור הודעות (לא נדרש)",
      ok: !requireOptIn || !!client?.whatsappOptIn,
      code: "missing_opt_in",
      detail: requireOptIn ? undefined : "הודעה תפעולית — אישור לא נדרש",
    });

    if (MARKETING_TYPES.has(messageType)) {
      checks.push({
        key: "marketing_opt_in",
        label: "הלקוחה אישרה הודעות שיווקיות",
        ok: !!client?.marketingOptIn,
        code: "missing_marketing_opt_in",
        detail: "נדרש להודעות שיווק / החזרת לקוחות",
      });

      // Cooldown — only meaningful for marketing/win-back.
      const setting = await prisma.automationSetting.findUnique({
        where: { businessId_type: { businessId, type: "win_back" } },
        select: { cooldownDays: true },
      });
      const cooldownDays = setting?.cooldownDays ?? 30;
      const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
      const recent = await prisma.automationMessage.findFirst({
        where: {
          businessId,
          clientId,
          type: "win_back",
          status: { in: ["queued", "sent", "delivered", "read"] },
          createdAt: { gt: cutoff },
        },
        select: { id: true },
      });
      checks.push({
        key: "cooldown",
        label: "מחוץ לתקופת ההמתנה",
        ok: !recent,
        code: "cooldown",
        detail: `תקופת המתנה: ${cooldownDays} ימים`,
      });
    }

    // Test-mode recipient match — a real client only receives if its number IS
    // the test phone while test mode is active.
    if (testMode) {
      const matches = !!testPhone && phonesEqual(clientPhone, testPhone);
      checks.push({
        key: "test_recipient",
        label: "נמען תואם למספר הבדיקה",
        ok: matches,
        code: "test_mode_recipient_mismatch",
        detail: matches ? undefined : "במצב בדיקה רק מספר הבדיקה יקבל את ההודעה",
      });
    }
  }

  // Trigger exists (informational — every supported type has a trigger).
  checks.push({
    key: "trigger",
    label: "קיים טריגר שליחה",
    ok: true,
    detail: TRIGGER_DETAIL[messageType],
  });

  const firstFail = checks.find((c) => !c.ok);
  const wouldSend = !firstFail;

  return {
    messageType,
    messageTypeLabel: DIAGNOSTIC_MESSAGE_TYPE_LABELS[messageType],
    wouldSend,
    blockReason: firstFail?.code
      ? { code: firstFail.code, label: whatsAppReasonLabel(firstFail.code) }
      : undefined,
    checks,
    context: {
      realSendEnabled,
      testMode,
      testPhoneMasked: testPhone ? maskPhone(testPhone) : undefined,
      providerName: resolved.provider.name,
      connectionStatusLabel: resolved.uiStatus,
      displayPhoneNumber: resolved.displayPhoneNumber,
      clientSelected: !!clientId,
    },
  };
}
