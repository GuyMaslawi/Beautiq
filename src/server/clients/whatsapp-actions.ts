"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness } from "@/server/auth/session";
import {
  getWhatsAppProvider,
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import { isValidIsraeliPhone } from "@/lib/phone";
import { buildWinBackMessage, buildOfferText } from "@/server/win-back-automation/message-builder";

export type ManualSendMessageType = "win_back" | "manual_test";

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

  // --- Recent message warning (non-blocking — owner can confirm) ---
  if (!forceIfRecent) {
    const recent = await hasRecentMessage(businessId, clientId);
    if (recent) {
      return { recentMessageWarning: true };
    }
  }

  // --- Load automation setting for template details ---
  const setting = await prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId, type: "win_back" } },
    select: {
      templateName: true,
      templateLanguage: true,
      messageTemplate: true,
      offerType: true,
      offerValue: true,
    },
  });

  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";

  // In real-send mode a Meta-approved template is required
  if (realSendEnabled && !setting?.templateName) {
    return { error: "לא הוגדרה תבנית הודעה מתאימה — יש להגדיר תבנית WhatsApp מאושרת בהגדרות האוטומציה" };
  }

  const lastServiceName = client.bookings[0]?.service.name;
  const offerText = buildOfferText(
    setting?.offerType ?? "none",
    setting?.offerValue ?? null,
  );

  const messageText =
    messageType === "manual_test"
      ? `היי ${client.fullName}, זוהי הודעת בדיקה מ${business.name} 👋`
      : buildWinBackMessage({
          clientName: client.fullName,
          businessName: business.name,
          lastServiceName: lastServiceName ?? undefined,
          offerType: setting?.offerType ?? "none",
          offerValue: setting?.offerValue ?? null,
          template: setting?.messageTemplate ?? null,
        });

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
      phone: client.normalizedPhone,
      messageText,
      templateId: setting?.templateName ?? undefined,
      status: "queued",
      source: "manual_owner",
    },
  });

  // --- Send ---
  const provider = getWhatsAppProvider();
  const templateVariables =
    setting?.templateName && setting.templateName !== "hello_world"
      ? {
          "1": client.fullName,
          "2": business.name,
          "3": lastServiceName ?? "",
          "4": offerText,
        }
      : undefined;

  const result = await provider.send({
    businessId,
    toPhone: client.normalizedPhone,
    templateId: setting?.templateName ?? undefined,
    templateLanguage: setting?.templateLanguage ?? "he",
    templateVariables,
    fallbackText: messageText,
    automationRunId: run.id,
    clientId: client.id,
  });

  // --- Handle result ---
  let finalStatus: "sent" | "skipped" | "failed";
  let providerMessageId: string | null = null;
  let failureReason: string | undefined;
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";

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
