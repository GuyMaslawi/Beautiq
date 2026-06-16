"use server";

import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import { getEligibleClients, getEligibilityBreakdown } from "./eligibility";
import { getBlockedClientsByReason } from "./blocked-clients";
import { runWinBackForBusiness } from "./runner";
import { isRealSendConfigured, isTestModeActive } from "@/lib/whatsapp/provider";
import { isMinuteTestingAllowed, resolveTimingUnit } from "@/lib/automation/minute-testing";
import { revalidatePath } from "next/cache";
import type {
  EligibilityCheckResult,
  ManualRunMessageResult,
  ManualRunResult,
} from "./shared-types";

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return "****" + phone.slice(-4);
}

function maskTestPhone(): string | undefined {
  const p = process.env.WHATSAPP_TEST_PHONE;
  if (!p || p.length < 4) return undefined;
  return "****" + p.slice(-4);
}

// ---------------------------------------------------------------------------
// Eligibility check (dry-run) — no messages sent
// ---------------------------------------------------------------------------

export async function checkWinBackEligibilityAction(
  params?: { ignoreCooldown?: boolean },
): Promise<EligibilityCheckResult> {
  try {
    const [business, user] = await Promise.all([
      requireCurrentBusiness(),
      getCurrentUser(),
    ]);

    // ignoreCooldown is an admin-only override — silently drop for non-admins
    const ignoreCooldown = (params?.ignoreCooldown === true) && (user?.isAdmin === true);

    const tenant = { businessId: business.id };

    const [setting, connection] = await Promise.all([
      prisma.automationSetting.findUnique({
        where: { businessId_type: { businessId: business.id, type: "win_back" } },
      }),
      prisma.whatsAppConnection.findUnique({
        where: { businessId: business.id },
      }),
    ]);

    const testModeActive = isTestModeActive();

    if (!setting) {
      return {
        success: true,
        automationEnabled: false,
        whatsappConnected: connection?.status === "active",
        realSendConfigured: isRealSendConfigured(),
        testModeActive,
        minuteModeActive: false,
        maskedTestPhone: testModeActive ? maskTestPhone() : undefined,
        breakdown: null,
        eligibleClients: [],
        blockedClients: null,
      };
    }

    // Honor the stored minute-test unit only when this admin/env may use it.
    const timingUnit = resolveTimingUnit(
      setting.timingUnit,
      isMinuteTestingAllowed({ isAdmin: user?.isAdmin === true }),
    );

    const options = {
      thresholdDays: setting.thresholdDays,
      cooldownDays: setting.cooldownDays,
      requireOptIn: setting.requireOptIn,
      ignoreCooldown,
      timingUnit,
      thresholdMinutes: setting.testThresholdMinutes,
      cooldownMinutes: setting.testCooldownMinutes,
    };

    const [breakdown, eligibleClients, blockedClients] = await Promise.all([
      getEligibilityBreakdown(tenant, options),
      getEligibleClients(tenant, options),
      getBlockedClientsByReason(tenant, options),
    ]);

    return {
      success: true,
      automationEnabled: setting.enabled,
      whatsappConnected: connection?.status === "active",
      realSendConfigured: isRealSendConfigured(),
      testModeActive,
      minuteModeActive: timingUnit === "minutes",
      maskedTestPhone: testModeActive ? maskTestPhone() : undefined,
      breakdown: {
        total: breakdown.total,
        eligible: breakdown.eligible,
        noCompletedBooking: breakdown.noCompletedBooking,
        hasFutureBooking: breakdown.hasFutureBooking,
        noOptIn: breakdown.noOptIn,
        invalidPhone: breakdown.invalidPhone,
        inCooldown: breakdown.inCooldown,
        cooldownOverrideCount: breakdown.cooldownOverrideCount,
      },
      eligibleClients: eligibleClients.map((c) => ({
        name: c.fullName,
        maskedPhone: maskPhone(c.normalizedPhone),
        lastService: c.lastServiceName,
        daysSinceLastVisit: c.daysSinceLastVisit,
      })),
      blockedClients,
    };
  } catch (err) {
    console.error("[checkWinBackEligibilityAction] error:", err);
    return {
      success: false,
      error: "בדיקת הזכאות נכשלה. יש לנסות שוב.",
      automationEnabled: false,
      whatsappConnected: false,
      realSendConfigured: false,
      testModeActive: false,
      minuteModeActive: false,
      breakdown: null,
      eligibleClients: [],
      blockedClients: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Manual run — real (or mock) send + per-client result report
// ---------------------------------------------------------------------------

export async function runWinBackManualAction(
  params?: { ignoreCooldown?: boolean },
): Promise<ManualRunResult> {
  const isMockMode = !isRealSendConfigured();
  const isTestMode = isTestModeActive();

  try {
    const [business, user] = await Promise.all([
      requireCurrentBusiness(),
      getCurrentUser(),
    ]);

    const ignoreCooldown = (params?.ignoreCooldown === true) && (user?.isAdmin === true);

    const result = await runWinBackForBusiness(
      business,
      ignoreCooldown ? { ignoreCooldown: true } : undefined,
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        mockSkipCount: 0,
        isMockMode,
        isTestMode,
        maskedTestPhone: isTestMode ? maskTestPhone() : undefined,
        messages: [],
      };
    }

    // Fetch per-client results from the created run record
    let messages: ManualRunMessageResult[] = [];
    if (result.runId) {
      const dbMessages = await prisma.automationMessage.findMany({
        where: { businessId: business.id, runId: result.runId },
        include: { client: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      });

      messages = dbMessages.map((m) => ({
        clientId: m.client.id,
        clientName: m.client.fullName,
        maskedPhone: maskPhone(m.phone),
        status: m.status,
        failureReason: m.failureReason,
      }));
    }

    revalidatePath("/automations");

    return {
      success: true,
      runId: result.runId,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      mockSkipCount: result.mockSkipCount,
      isMockMode,
      isTestMode,
      maskedTestPhone: isTestMode ? maskTestPhone() : undefined,
      messages,
    };
  } catch (err) {
    console.error("[runWinBackManualAction] error:", err);
    return {
      success: false,
      error: "הרצת האוטומציה נכשלה. יש לנסות שוב.",
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      mockSkipCount: 0,
      isMockMode,
      isTestMode,
      maskedTestPhone: isTestMode ? maskTestPhone() : undefined,
      messages: [],
    };
  }
}
