import { prisma } from "@/server/db/prisma";
import { getEligibleClients } from "./eligibility";
import { buildWinBackMessage } from "./message-builder";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
  isTestModeActive,
} from "@/lib/whatsapp/provider";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { isValidIsraeliPhone } from "@/lib/phone";
import { isMinuteTestingAllowed, resolveTimingUnit } from "@/lib/automation/minute-testing";

export interface WinBackRunResult {
  success: boolean;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  mockSkipCount: number;
  runId?: string;
  error?: string;
}

/**
 * Core win-back run logic — no session/auth dependency.
 * Called by both the manual server action and the daily cron handler.
 * adminOptions is only ever set from manual admin runs — cron always omits it.
 */
export async function runWinBackForBusiness(
  business: { id: string; name: string; slug: string },
  adminOptions?: { ignoreCooldown?: boolean },
): Promise<WinBackRunResult> {
  const setting = await prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: business.id, type: "win_back" } },
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

  if (realSendEnabled && testMode && !process.env.WHATSAPP_TEST_PHONE) {
    return {
      success: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      mockSkipCount: 0,
      error: "מצב בדיקה פעיל אך WHATSAPP_TEST_PHONE לא מוגדר.",
    };
  }

  // Test-only minute mode. The runner has no user context (cron-safe), so it
  // gates purely on the environment: a setting left in "minutes" only fires on
  // minutes in non-production or when ENABLE_AUTOMATION_MINUTE_TESTING=true.
  // Otherwise it falls back to days, so production never sends on minutes by accident.
  const timingUnit = resolveTimingUnit(setting.timingUnit, isMinuteTestingAllowed());

  const tenant = { businessId: business.id };
  const eligible = await getEligibleClients(tenant, {
    thresholdDays: setting.thresholdDays,
    cooldownDays: setting.cooldownDays,
    requireOptIn: setting.requireOptIn,
    ignoreCooldown: adminOptions?.ignoreCooldown,
    timingUnit,
    thresholdMinutes: setting.testThresholdMinutes,
    cooldownMinutes: setting.testCooldownMinutes,
  });

  const run = await prisma.automationRun.create({
    data: {
      businessId: business.id,
      type: "win_back",
      status: "running",
      eligibleCount: eligible.length,
    },
  });

  const provider = await getWhatsAppProviderForBusiness(business.id);
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let mockSkipCount = 0;

  for (const client of eligible) {
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

    // hello_world is Meta's zero-variable sandbox template; sending body
    // components against it triggers error 131008. The neutral win-back template
    // carries exactly 2 vars: client name + business name (no service/offer var).
    const templateVariables =
      setting.templateName === "hello_world"
        ? undefined
        : {
            "1": client.fullName,
            "2": business.name,
          };

    const result = await provider.send({
      businessId: business.id,
      toPhone: client.normalizedPhone,
      templateId: setting.templateName ?? undefined,
      templateLanguage: setting.templateLanguage ?? "he",
      templateVariables,
      fallbackText: messageText,
      automationRunId: run.id,
      clientId: client.id,
    });

    if (result.isMockSkip) {
      await prisma.automationMessage.update({
        where: { id: automationMessage.id },
        data: { status: "skipped", failureReason: DEV_MOCK_SKIP_REASON },
      });
      mockSkipCount++;
      skippedCount++;
    } else if (result.isTestModeBlock) {
      await prisma.automationMessage.update({
        where: { id: automationMessage.id },
        data: { status: "skipped", failureReason: TEST_MODE_BLOCKED_REASON },
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
        data: { status: "failed", failureReason: result.failureReason },
      });
      failedCount++;
    }
  }

  const finalStatus =
    failedCount > 0 && sentCount === 0 ? "failed" : "completed";

  await prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      sentCount,
      failedCount,
      skippedCount,
    },
  });

  console.log(
    `[runWinBackForBusiness] done — businessId=${business.id} timingUnit=${timingUnit} ` +
      `eligible=${eligible.length} sent=${sentCount} failed=${failedCount} ` +
      `skipped=${skippedCount} mock=${mockSkipCount} status=${finalStatus}`,
  );

  return { success: true, sentCount, skippedCount, failedCount, mockSkipCount, runId: run.id };
}
