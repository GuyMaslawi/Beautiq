"use server";

import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import { revalidatePath } from "next/cache";
import type { AutomationOfferType } from "@prisma/client";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { runWinBackForBusiness } from "./runner";
import { publicBusinessUrl } from "@/lib/config";
import { isMinuteTestingAllowed } from "@/lib/automation/minute-testing";

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
    const bookingUrl = publicBusinessUrl(business.slug);
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

    const provider = await getWhatsAppProviderForBusiness(business.id);
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
  /** Test-only timing unit. "minutes" is ignored unless the caller may use it. */
  timingUnit?: "days" | "minutes";
  /** Test-only inactivity threshold in minutes (only persisted in minute mode). */
  testThresholdMinutes?: number | null;
  /** Test-only cooldown in minutes (only persisted in minute mode). */
  testCooldownMinutes?: number | null;
}

export async function saveWinBackAutomationSetting(
  input: SaveWinBackSettingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const [business, user] = await Promise.all([
      requireCurrentBusiness(),
      getCurrentUser(),
    ]);

    // Minute mode is gated server-side: a crafted request from a regular owner
    // in production cannot enable it. When not allowed, force days and drop the
    // minute values so production behavior can never be changed by accident.
    const allowMinutes = isMinuteTestingAllowed({ isAdmin: user?.isAdmin === true });
    const timingUnit: "days" | "minutes" =
      allowMinutes && input.timingUnit === "minutes" ? "minutes" : "days";
    const testThresholdMinutes =
      timingUnit === "minutes" ? input.testThresholdMinutes ?? null : null;
    const testCooldownMinutes =
      timingUnit === "minutes" ? input.testCooldownMinutes ?? null : null;

    const data = {
      enabled: input.enabled,
      thresholdDays: input.thresholdDays,
      sendHour: input.sendHour,
      messageTemplate: input.messageTemplate,
      offerType: input.offerType,
      offerValue: input.offerValue,
      cooldownDays: input.cooldownDays,
      requireOptIn: input.requireOptIn,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      timingUnit,
      testThresholdMinutes,
      testCooldownMinutes,
    };

    await prisma.automationSetting.upsert({
      where: {
        businessId_type: { businessId: business.id, type: "win_back" },
      },
      create: {
        businessId: business.id,
        type: "win_back",
        ...data,
      },
      update: data,
    });

    revalidatePath("/bring-back");
    revalidatePath("/automations");
    return { success: true };
  } catch {
    return { success: false, error: "שמירת ההגדרות נכשלה. יש לנסות שוב." };
  }
}

// ---------------------------------------------------------------------------
// Toggle automation enabled state (hero CTA)
// ---------------------------------------------------------------------------

export async function toggleWinBackAutomation(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const business = await requireCurrentBusiness();
    await prisma.automationSetting.upsert({
      where: { businessId_type: { businessId: business.id, type: "win_back" } },
      create: {
        businessId: business.id,
        type: "win_back",
        enabled,
        thresholdDays: 45,
        sendHour: 10,
        messageTemplate: null,
        offerType: "none" as AutomationOfferType,
        offerValue: null,
        cooldownDays: 30,
        requireOptIn: true,
        templateName: null,
        templateLanguage: "he",
      },
      update: { enabled },
    });
    revalidatePath("/bring-back");
    revalidatePath("/automations");
    return { success: true };
  } catch {
    return { success: false, error: "שמירה נכשלה. יש לנסות שוב." };
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
    const result = await runWinBackForBusiness(business);
    revalidatePath("/bring-back");
    revalidatePath("/automations");
    return result;
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
