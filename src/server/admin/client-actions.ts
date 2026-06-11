"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { normalizePhone, isValidIsraeliPhone } from "@/lib/phone";
import {
  getWhatsAppProvider,
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import { buildWinBackMessage, buildOfferText } from "@/server/win-back-automation/message-builder";
import type { ManualSendMessageType, ManualSendResult } from "@/server/clients/whatsapp-actions";

export interface AdminUpdateClientState {
  success?: boolean;
  fieldErrors?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  formError?: string;
}

export async function adminUpdateClientAction(
  clientId: string,
  _prevState: AdminUpdateClientState,
  formData: FormData,
): Promise<AdminUpdateClientState> {
  await requirePlatformAdmin();

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, businessId: true },
  });

  if (!existing) return { formError: "הלקוחה לא נמצאה" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const whatsappOptIn = formData.getAll("whatsappOptIn").includes("true");
  const marketingOptIn = formData.getAll("marketingOptIn").includes("true");

  const fieldErrors: NonNullable<AdminUpdateClientState["fieldErrors"]> = {};

  if (!fullName) fieldErrors.fullName = "יש למלא את שם הלקוחה";

  if (!phone) {
    fieldErrors.phone = "יש למלא מספר טלפון";
  } else if (!isValidIsraeliPhone(phone)) {
    fieldErrors.phone = "מספר הטלפון לא תקין";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const normalizedPhone = normalizePhone(phone);

  // Duplicate check scoped to the client's own businessId (not globally)
  const duplicate = await prisma.client.findUnique({
    where: {
      businessId_normalizedPhone: {
        businessId: existing.businessId,
        normalizedPhone,
      },
    },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== clientId) {
    return { fieldErrors: { phone: "כבר קיימת לקוחה עם מספר הטלפון הזה בעסק הזה" } };
  }

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: { fullName, phone, normalizedPhone, email, notes, whatsappOptIn, marketingOptIn },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { fieldErrors: { phone: "כבר קיימת לקוחה עם מספר הטלפון הזה בעסק הזה" } };
    }
    return { formError: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  revalidatePath("/admin/clients");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Admin manual WhatsApp send — uses the client's own business connection
// ---------------------------------------------------------------------------

/**
 * Platform admin sends a WhatsApp message to any client.
 * Uses the client's businessId to pick the correct WhatsApp connection.
 * Never uses any other business's connection.
 */
export async function adminSendManualClientWhatsAppAction(
  clientId: string,
  messageType: ManualSendMessageType,
): Promise<ManualSendResult> {
  await requirePlatformAdmin();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessId: true,
      fullName: true,
      phone: true,
      normalizedPhone: true,
      unsubscribedAt: true,
      business: { select: { id: true, name: true, slug: true } },
      bookings: {
        where: { status: "completed" },
        orderBy: { startTime: "desc" },
        take: 1,
        select: { id: true, service: { select: { name: true } } },
      },
    },
  });

  if (!client) return { error: "הלקוחה לא נמצאה" };

  if (!client.normalizedPhone || !isValidIsraeliPhone(client.normalizedPhone)) {
    return { error: "אין ללקוחה מספר טלפון תקין" };
  }

  if (client.unsubscribedAt) {
    return { error: "הלקוחה הסירה עצמה מרשימת ההודעות" };
  }

  const businessId = client.businessId;

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { businessId },
    select: { status: true },
  });

  if (!connection || connection.status !== "active") {
    return { error: "WhatsApp לא מחובר לעסק של הלקוחה הזו" };
  }

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

  if (realSendEnabled && !setting?.templateName) {
    return { error: "לא הוגדרה תבנית הודעה מתאימה לעסק הזה" };
  }

  const lastServiceName = client.bookings[0]?.service.name;
  const offerText = buildOfferText(
    setting?.offerType ?? "none",
    setting?.offerValue ?? null,
  );

  const messageText =
    messageType === "manual_test"
      ? `היי ${client.fullName}, זוהי הודעת בדיקה ממנהל Allura 👋`
      : buildWinBackMessage({
          clientName: client.fullName,
          businessName: client.business.name,
          lastServiceName: lastServiceName ?? undefined,
          offerType: setting?.offerType ?? "none",
          offerValue: setting?.offerValue ?? null,
          template: setting?.messageTemplate ?? null,
        });

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
      source: "manual_admin",
    },
  });

  const provider = getWhatsAppProvider();
  const templateVariables =
    setting?.templateName && setting.templateName !== "hello_world"
      ? {
          "1": client.fullName,
          "2": client.business.name,
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

  revalidatePath("/admin/clients");

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
