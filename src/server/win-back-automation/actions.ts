"use server";

import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import type { AutomationOfferType } from "@prisma/client";
import { getEligibleClients } from "./eligibility";
import { buildWinBackMessage, buildOfferText } from "./message-builder";
import {
  getWhatsAppProvider,
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
  isTestModeActive,
} from "@/lib/whatsapp/provider";
import { isValidIsraeliPhone } from "@/lib/phone";

// ---------------------------------------------------------------------------
// Test send — send one real message to WHATSAPP_TEST_PHONE only
// ---------------------------------------------------------------------------

export type TestSendErrorCode =
  | "missing_test_mode"
  | "missing_real_send"
  | "missing_provider"
  | "missing_credentials"
  | "missing_test_phone"
  | "missing_template"
  | "provider_error";

export interface TestSendResult {
  success: boolean;
  providerMessageId?: string | null;
  sentAt?: string;
  error?: string;
  errorCode?: TestSendErrorCode;
}

export async function sendWhatsAppTestMessage(): Promise<TestSendResult> {
  try {
    const business = await requireCurrentBusiness();

    // All required env vars must be present — fail fast with a specific code
    if (process.env.WHATSAPP_TEST_MODE !== "true") {
      return { success: false, errorCode: "missing_test_mode" };
    }
    if (process.env.ENABLE_REAL_WHATSAPP_SEND !== "true") {
      return { success: false, errorCode: "missing_real_send" };
    }
    if (process.env.WHATSAPP_PROVIDER !== "meta_cloud_api") {
      return { success: false, errorCode: "missing_provider" };
    }
    if (!process.env.META_WHATSAPP_ACCESS_TOKEN || !process.env.META_WHATSAPP_PHONE_NUMBER_ID) {
      return { success: false, errorCode: "missing_credentials" };
    }
    const testPhone = process.env.WHATSAPP_TEST_PHONE;
    if (!testPhone) {
      return { success: false, errorCode: "missing_test_phone" };
    }

    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId: business.id, type: "win_back" } },
    });

    if (!setting?.templateName) {
      return { success: false, errorCode: "missing_template" };
    }

    // Safe sample fallback text — no real customer data
    const bookingUrl = `allura.app/b/${business.slug}`;
    const sampleFallbackText =
      `היי בדיקה, עבר זמן מה מאז הביקור האחרון שלך בטיפול לדוגמה אצל ${business.name}.\n` +
      `10% הנחה\nנשמח לראות אותך שוב ❤️\nלקביעת תור: ${bookingUrl}`;

    const run = await prisma.automationRun.create({
      data: {
        businessId: business.id,
        type: "win_back",
        status: "running",
        eligibleCount: 1,
      },
    });

    const provider = getWhatsAppProvider();
    const result = await provider.send({
      businessId: business.id,
      toPhone: testPhone,
      templateId: setting.templateName,
      templateLanguage: setting.templateLanguage ?? "he",
      templateVariables: {
        "1": "בדיקה",
        "2": business.name,
        "3": "טיפול לדוגמה",
        "4": "10% הנחה",
      },
      fallbackText: sampleFallbackText,
      automationRunId: run.id,
      clientId: "test-send",
    });

    if (result.success) {
      const now = new Date();
      await Promise.all([
        prisma.automationRun.update({
          where: { id: run.id },
          data: { status: "completed", finishedAt: now, sentCount: 1 },
        }),
        // Record first successful sandbox test (only set if not already set)
        prisma.automationSetting.update({
          where: { businessId_type: { businessId: business.id, type: "win_back" } },
          data: { testSendPassedAt: setting.testSendPassedAt ?? now },
        }),
      ]);
      console.log(
        `[sendWhatsAppTestMessage] success — businessId=${business.id} runId=${run.id} ` +
          `providerMessageId=${result.providerMessageId} provider=${provider.name} status=sent`,
      );
      revalidatePath("/bring-back");
      return {
        success: true,
        providerMessageId: result.providerMessageId,
        sentAt: now.toISOString(),
      };
    }

    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), failedCount: 1 },
    });
    console.error(
      `[sendWhatsAppTestMessage] failed — businessId=${business.id} runId=${run.id} ` +
        `provider=${provider.name} status=failed reason=${result.failureReason}`,
    );
    return {
      success: false,
      errorCode: "provider_error",
      error: result.failureReason,
    };
  } catch (err) {
    console.error("[sendWhatsAppTestMessage] error:", err);
    return { success: false, errorCode: "provider_error" };
  }
}

// ---------------------------------------------------------------------------
// Save automation settings
// ---------------------------------------------------------------------------

export interface SaveWinBackSettingInput {
  enabled: boolean;
  thresholdDays: number;
  sendHour: number;
  messageTemplate: string | null;
  offerType: AutomationOfferType;
  offerValue: string | null;
  cooldownDays: number;
  requireOptIn: boolean;
  /** Meta-approved template name for real WhatsApp Cloud API sends */
  templateName: string | null;
  /** BCP 47 language code for the approved template (default: "he") */
  templateLanguage: string | null;
}

export async function saveWinBackAutomationSetting(
  input: SaveWinBackSettingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const business = await requireCurrentBusiness();

    await prisma.automationSetting.upsert({
      where: {
        businessId_type: { businessId: business.id, type: "win_back" },
      },
      create: {
        businessId: business.id,
        type: "win_back",
        ...input,
      },
      update: input,
    });

    revalidatePath("/bring-back");
    revalidatePath("/automations");
    return { success: true };
  } catch {
    return { success: false, error: "שמירת ההגדרות נכשלה. יש לנסות שוב." };
  }
}

// ---------------------------------------------------------------------------
// Trigger manual automation run (dev-safe)
// ---------------------------------------------------------------------------

export async function triggerWinBackRun(): Promise<{
  success: boolean;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  mockSkipCount: number;
  error?: string;
}> {
  try {
    const business = await requireCurrentBusiness();
    const tenant = { businessId: business.id };

    const setting = await prisma.automationSetting.findUnique({
      where: {
        businessId_type: { businessId: business.id, type: "win_back" },
      },
    });

    if (!setting?.enabled) {
      return {
        success: false,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        mockSkipCount: 0,
        error: "האוטומציה אינה מופעלת.",
      };
    }

    // Approved template required whenever a real API call will be made
    // (real send enabled, with or without test mode).
    const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
    const testMode = isTestModeActive();
    if (realSendEnabled && !setting.templateName) {
      return {
        success: false,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        mockSkipCount: 0,
        error: "תבנית WhatsApp מאושרת נדרשת לשליחה אוטומטית.",
      };
    }

    // In test mode, WHATSAPP_TEST_PHONE must be configured
    if (realSendEnabled && testMode && !process.env.WHATSAPP_TEST_PHONE) {
      return {
        success: false,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        mockSkipCount: 0,
        error: "מצב בדיקה פעיל אך WHATSAPP_TEST_PHONE לא מוגדר. השלימי את ההגדרה.",
      };
    }

    const eligible = await getEligibleClients(tenant, {
      thresholdDays: setting.thresholdDays,
      cooldownDays: setting.cooldownDays,
      requireOptIn: setting.requireOptIn,
    });

    const run = await prisma.automationRun.create({
      data: {
        businessId: business.id,
        type: "win_back",
        status: "running",
        eligibleCount: eligible.length,
      },
    });

    const provider = getWhatsAppProvider();
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let mockSkipCount = 0;

    for (const client of eligible) {
      // Secondary phone validation guard before provider call
      if (!isValidIsraeliPhone(client.normalizedPhone)) {
        await prisma.automationMessage.create({
          data: {
            businessId: business.id,
            runId: run.id,
            clientId: client.id,
            bookingId: client.lastBookingId,
            type: "win_back",
            phone: client.phone,
            messageText: "",
            status: "skipped",
            failureReason: "מספר טלפון לא תקין",
          },
        });
        skippedCount++;
        continue;
      }

      const messageText = buildWinBackMessage({
        clientName: client.fullName,
        businessName: business.name,
        lastServiceName: client.lastServiceName,
        offerType: setting.offerType,
        offerValue: setting.offerValue,
        template: setting.messageTemplate,
      });

      const offerText = buildOfferText(setting.offerType, setting.offerValue);

      const automationMessage = await prisma.automationMessage.create({
        data: {
          businessId: business.id,
          runId: run.id,
          clientId: client.id,
          bookingId: client.lastBookingId,
          type: "win_back",
          phone: client.normalizedPhone,
          messageText,
          templateId: setting.templateName ?? undefined,
          status: "queued",
        },
      });

      const result = await provider.send({
        businessId: business.id,
        toPhone: client.normalizedPhone,
        templateId: setting.templateName ?? undefined,
        templateLanguage: setting.templateLanguage ?? "he",
        templateVariables: {
          "1": client.fullName,
          "2": business.name,
          "3": client.lastServiceName ?? "",
          "4": offerText,
        },
        fallbackText: messageText,
        automationRunId: run.id,
        clientId: client.id,
      });

      if (result.isMockSkip) {
        await prisma.automationMessage.update({
          where: { id: automationMessage.id },
          data: {
            status: "skipped",
            failureReason: DEV_MOCK_SKIP_REASON,
          },
        });
        mockSkipCount++;
        skippedCount++;
      } else if (result.isTestModeBlock) {
        await prisma.automationMessage.update({
          where: { id: automationMessage.id },
          data: {
            status: "skipped",
            failureReason: TEST_MODE_BLOCKED_REASON,
          },
        });
        skippedCount++;
      } else if (result.success) {
        await prisma.automationMessage.update({
          where: { id: automationMessage.id },
          data: {
            status: "sent",
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
          },
        });
        sentCount++;
      } else {
        await prisma.automationMessage.update({
          where: { id: automationMessage.id },
          data: {
            status: "failed",
            failureReason: result.failureReason,
          },
        });
        failedCount++;
      }
    }

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 && sentCount === 0 ? "failed" : "completed",
        finishedAt: new Date(),
        sentCount,
        failedCount,
        skippedCount,
      },
    });

    revalidatePath("/bring-back");
    revalidatePath("/automations");

    return { success: true, sentCount, skippedCount, failedCount, mockSkipCount };
  } catch (err) {
    console.error("[triggerWinBackRun] error:", err);
    return {
      success: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      mockSkipCount: 0,
      error: "הרצת האוטומציה נכשלה. יש לנסות שוב.",
    };
  }
}
