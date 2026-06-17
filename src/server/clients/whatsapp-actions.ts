"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";
import { buildWinBackMessage } from "@/server/win-back-automation/message-builder";

export type ManualSendMessageType =
  | "win_back"
  | "appointment_reminder"
  | "review_request"
  | "manual_test";

export interface ManualSendResult {
  success?: boolean;
  error?: string;
  /** Shown in UI when recipient is the test phone instead of real client phone */
  isTestMode?: boolean;
  /** True when a message was already sent to this client recently (last 24h) */
  recentMessageWarning?: boolean;
}

// Check if the client was sent any message in the last 24 hours
async function hasRecentMessage(businessId: string, clientId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.automationMessage.count({
    where: {
      businessId,
      clientId,
      createdAt: { gte: since },
      status: { in: ["sent", "delivered", "read", "queued"] },
    },
  });
  return count > 0;
}

function maskPhoneForLog(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "***";
  return d.slice(0, 3) + "***" + d.slice(-3);
}

function applyReminderVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{[^}]+\}/g, (m) => vars[m] ?? m);
}

const DEFAULT_REMINDER_TEXT =
  "בוקר טוב {שם הלקוח} ☀️\n\nרק תזכורת קטנה שיש לך תור ב{שם העסק}.\n\nמחכות לראותך ❤️";

const DEFAULT_REVIEW_TEXT =
  "היי {שם הלקוח} ❤️\n\nנהנינו לארח אותך!\n\nנשמח אם תוכלי להשאיר ביקורת קצרה 🙏\n{קישור לביקורת}\n\n{שם העסק}";

/**
 * Business owner sends a WhatsApp message to one of their own clients manually.
 *
 * businessId is always derived from the authenticated session — never trusted from client input.
 * forceIfRecent bypasses the 24h recent-message warning when the owner confirms they want to proceed.
 */
export async function sendManualClientWhatsAppAction(
  clientId: string,
  messageType: ManualSendMessageType,
  forceIfRecent?: boolean,
): Promise<ManualSendResult> {
  const business = await requireCurrentBusiness();
  const businessId = business.id;

  // --- Load & validate client (scoped by businessId) ---
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessId: true,
      fullName: true,
      phone: true,
      normalizedPhone: true,
      unsubscribedAt: true,
      whatsappOptIn: true,
      marketingOptIn: true,
      bookings: {
        where: { businessId, status: "completed" },
        orderBy: { startTime: "desc" },
        take: 1,
        select: { id: true, service: { select: { name: true } } },
      },
    },
  });

  if (!client || client.businessId !== businessId) {
    return { error: "הלקוחה לא נמצאה" };
  }

  if (!client.normalizedPhone || !isValidIsraeliPhone(client.normalizedPhone)) {
    return { error: "אין ללקוחה מספר טלפון תקין" };
  }

  if (client.unsubscribedAt) {
    return { error: "הלקוחה לא מעוניינת בקבלת הודעות" };
  }

  // --- WhatsApp connection ---
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
    select: { status: true },
  });

  if (!connection || connection.status !== "active") {
    return { error: "WhatsApp לא מחובר לעסק הזה" };
  }

  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";

  // --- Build message per type ---
  let messageText: string;
  let effectiveTemplateName: string | undefined;
  let effectiveTemplateLanguage: string | undefined;
  let templateVariables: Record<string, string> | undefined;

  const lastServiceName = client.bookings[0]?.service.name;

  if (messageType === "win_back") {
    // Load win_back automation setting
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "win_back" } },
      select: {
        templateName: true,
        templateLanguage: true,
        messageTemplate: true,
        offerType: true,
        offerValue: true,
        requireOptIn: true,
      },
    });

    // Opt-in guards for win_back (marketing message)
    if ((setting?.requireOptIn ?? false) && !client.whatsappOptIn) {
      return { error: "הלקוחה לא אישרה קבלת הודעות WhatsApp" };
    }
    if (!client.marketingOptIn) {
      return { error: "הלקוחה לא אישרה הודעות שיווקיות" };
    }

    if (realSendEnabled && !setting?.templateName) {
      return { error: "תבנית ההודעה עדיין לא מוגדרת — יש להגדיר תבנית WhatsApp מאושרת בהגדרות אוטומציית החזרת הלקוחות" };
    }

    messageText = buildWinBackMessage({
      clientName: client.fullName,
      businessName: business.name,
      lastServiceName: lastServiceName ?? undefined,
      offerType: setting?.offerType ?? "none",
      offerValue: setting?.offerValue ?? null,
      template: setting?.messageTemplate ?? null,
    });
    effectiveTemplateName = setting?.templateName ?? undefined;
    effectiveTemplateLanguage = setting?.templateLanguage ?? "he";
    // The neutral win-back template carries exactly 2 vars (name + business).
    if (effectiveTemplateName) {
      templateVariables = {
        "1": client.fullName,
        "2": business.name,
      };
    }

  } else if (messageType === "appointment_reminder") {
    // Appointment reminder — no marketingOptIn required
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "morning_reminder" } },
      select: { templateName: true, templateLanguage: true, messageTemplate: true },
    });

    if (realSendEnabled && !setting?.templateName) {
      return { error: "תבנית ההודעה עדיין לא מוגדרת — יש להגדיר תבנית WhatsApp מאושרת בהגדרות תזכורת התור" };
    }

    const templateBody = setting?.messageTemplate ?? DEFAULT_REMINDER_TEXT;
    messageText = applyReminderVariables(templateBody, {
      "{שם הלקוח}": client.fullName,
      "{שם הלקוחה}": client.fullName,
      "{שם העסק}": business.name,
      "{שירות}": lastServiceName ?? "טיפול",
      "{clientName}": client.fullName,
      "{businessName}": business.name,
    });
    effectiveTemplateName = setting?.templateName ?? undefined;
    effectiveTemplateLanguage = setting?.templateLanguage ?? "he";
    if (effectiveTemplateName) {
      templateVariables = {
        "1": client.fullName,
        "2": business.name,
        "3": lastServiceName ?? "טיפול",
      };
    }

  } else if (messageType === "review_request") {
    // Review request — no marketingOptIn required
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "review_request" } },
      select: { templateName: true, templateLanguage: true, messageTemplate: true, offerValue: true },
    });

    if (realSendEnabled && !setting?.templateName) {
      return { error: "תבנית ההודעה עדיין לא מוגדרת — יש להגדיר תבנית WhatsApp מאושרת בהגדרות בקשת הביקורת" };
    }

    const reviewLink = setting?.offerValue ?? "";
    const templateBody = setting?.messageTemplate ?? DEFAULT_REVIEW_TEXT;
    messageText = applyReminderVariables(templateBody, {
      "{שם הלקוח}": client.fullName,
      "{שם הלקוחה}": client.fullName,
      "{שם העסק}": business.name,
      "{שירות}": lastServiceName ?? "טיפול",
      "{קישור לביקורת}": reviewLink,
      "{review_link}": reviewLink,
      "{clientName}": client.fullName,
      "{businessName}": business.name,
    });
    effectiveTemplateName = setting?.templateName ?? undefined;
    effectiveTemplateLanguage = setting?.templateLanguage ?? "he";
    if (effectiveTemplateName) {
      templateVariables = {
        "1": client.fullName,
        "2": business.name,
        "3": reviewLink,
      };
    }

  } else {
    // manual_test — admin only
    messageText = `היי ${client.fullName}, זוהי הודעת בדיקה מ${business.name} 👋`;
    // manual_test without a configured template uses hello_world
    const winBackSetting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId, type: "win_back" } },
      select: { templateName: true, templateLanguage: true },
    });
    effectiveTemplateName =
      winBackSetting?.templateName ?? "hello_world";
    effectiveTemplateLanguage =
      winBackSetting?.templateName ? (winBackSetting.templateLanguage ?? "he") : "en_US";
  }

  // --- Recent message warning (non-blocking — owner can confirm) ---
  if (!forceIfRecent) {
    const recent = await hasRecentMessage(businessId, clientId);
    if (recent) {
      return { recentMessageWarning: true };
    }
  }

  // --- Test mode recipient redirect ---
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
  const testPhone = process.env.WHATSAPP_TEST_PHONE;
  if (isTestMode && !testPhone) {
    return { error: "WHATSAPP_TEST_PHONE לא מוגדר — לא ניתן לשלוח במצב בדיקה" };
  }
  const recipientPhone = isTestMode && testPhone ? testPhone : client.normalizedPhone;

  console.log(
    `[WhatsApp manual send] START — businessId=${businessId} clientId=${clientId} messageType=${messageType} isTestMode=${isTestMode} recipientType=${isTestMode ? "test_phone" : "client"} maskedRecipient=${maskPhoneForLog(recipientPhone)} template=${effectiveTemplateName} lang=${effectiveTemplateLanguage}`,
  );

  // --- Create run & message log ---
  const run = await prisma.automationRun.create({
    data: {
      businessId,
      type: "manual",
      status: "running",
      eligibleCount: 1,
    },
  });

  const automationMessage = await prisma.automationMessage.create({
    data: {
      businessId,
      runId: run.id,
      clientId: client.id,
      type: "manual",
      phone: recipientPhone,
      messageText,
      templateId: effectiveTemplateName,
      status: "queued",
      source: "manual_owner",
    },
  });

  // --- Send ---
  const provider = await getWhatsAppProviderForBusiness(businessId);

  const result = await provider.send({
    businessId,
    toPhone: recipientPhone,
    templateId: effectiveTemplateName,
    templateLanguage: effectiveTemplateLanguage,
    templateVariables,
    fallbackText: messageText,
    automationRunId: run.id,
    clientId: client.id,
  });

  // --- Handle result ---
  let finalStatus: "sent" | "skipped" | "failed";
  let providerMessageId: string | null = null;
  let failureReason: string | undefined;

  if (result.isMockSkip) {
    finalStatus = "skipped";
    failureReason = DEV_MOCK_SKIP_REASON;
  } else if (result.isTestModeBlock) {
    finalStatus = "skipped";
    failureReason = TEST_MODE_BLOCKED_REASON;
  } else if (result.success) {
    finalStatus = "sent";
    providerMessageId = result.providerMessageId;
  } else {
    finalStatus = "failed";
    failureReason = result.failureReason;
  }

  console.log(
    `[WhatsApp manual send] RESULT — businessId=${businessId} clientId=${clientId} messageId=${automationMessage.id} finalStatus=${finalStatus} providerMessageId=${providerMessageId ?? "none"} failureReason=${failureReason ?? "none"}`,
  );

  await prisma.automationMessage.update({
    where: { id: automationMessage.id },
    data: {
      status: finalStatus,
      providerMessageId: providerMessageId ?? undefined,
      failureReason: failureReason ?? undefined,
      sentAt: finalStatus === "sent" ? new Date() : undefined,
    },
  });

  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: result.success ? "completed" : "failed",
      finishedAt: new Date(),
      sentCount: result.success ? 1 : 0,
      failedCount: result.success ? 0 : 1,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/automations");

  if (result.isMockSkip) {
    return { success: true, isTestMode: false };
  }

  if (result.isTestModeBlock) {
    return { error: "ההודעה נחסמה במצב בדיקה — הלקוחה אינה מספר הבדיקה" };
  }

  if (!result.success) {
    return { error: "שליחת ההודעה נכשלה" };
  }

  return { success: true, isTestMode };
}
