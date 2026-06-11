"use server";

import { prisma } from "@/server/db/prisma";
import { requireCurrentBusiness, getCurrentUser } from "@/server/auth/session";
import { getEligibleClients, getEligibilityBreakdown } from "./eligibility";
import { getBlockedClientsByReason } from "./blocked-clients";
import type { BlockedClientsByReason } from "./blocked-clients";
import { runWinBackForBusiness } from "./runner";
import { isRealSendConfigured, isTestModeActive } from "@/lib/whatsapp/provider";
import { revalidatePath } from "next/cache";

export type { BlockedClientsByReason };
export type { BlockedClientPreview } from "./blocked-clients";

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

export interface EligibleClientPreview {
  name: string;
  maskedPhone: string;
  lastService: string;
  daysSinceLastVisit: number;
}

export interface EligibilityBreakdownResult {
  total: number;
  eligible: number;
  noCompletedBooking: number;
  hasFutureBooking: number;
  noOptIn: number;
  invalidPhone: number;
  inCooldown: number;
  /** Admin override: how many cooldown clients were included instead of skipped */
  cooldownOverrideCount: number;
}

export interface EligibilityCheckResult {
  success: boolean;
  error?: string;
  automationEnabled: boolean;
  whatsappConnected: boolean;
  realSendConfigured: boolean;
  testModeActive: boolean;
  /** Masked last-4 of WHATSAPP_TEST_PHONE, present only when testModeActive */
  maskedTestPhone?: string;
  breakdown: EligibilityBreakdownResult | null;
  eligibleClients: EligibleClientPreview[];
  /** Per-client priority-based blocking reason breakdown */
  blockedClients: BlockedClientsByReason | null;
}

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
        maskedTestPhone: testModeActive ? maskTestPhone() : undefined,
        breakdown: null,
        eligibleClients: [],
        blockedClients: null,
      };
    }

    const options = {
      thresholdDays: setting.thresholdDays,
      cooldownDays: setting.cooldownDays,
      requireOptIn: setting.requireOptIn,
      ignoreCooldown,
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
      breakdown: null,
      eligibleClients: [],
      blockedClients: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Manual run — real (or mock) send + per-client result report
// ---------------------------------------------------------------------------

export interface ManualRunMessageResult {
  clientId: string;
  clientName: string;
  maskedPhone: string;
  status: string;
  failureReason: string | null;
}

export interface ManualRunResult {
  success: boolean;
  error?: string;
  runId?: string;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  mockSkipCount: number;
  isMockMode: boolean;
  isTestMode: boolean;
  /** Masked last-4 of WHATSAPP_TEST_PHONE, present only when isTestMode */
  maskedTestPhone?: string;
  messages: ManualRunMessageResult[];
}

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
