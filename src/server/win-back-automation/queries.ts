import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type {
  AutomationSetting,
  WhatsAppConnection,
  AutomationRun,
  AutomationMessage,
} from "@prisma/client";
import { getEligibleClients, getEligibilityBreakdown } from "./eligibility";
import type { EligibilityBreakdown } from "./eligibility";
import {
  DEV_MOCK_SKIP_REASON,
  isRealSendConfigured,
  isTestModeActive,
  isTestPhoneConfigured,
} from "@/lib/whatsapp/provider";

export type { AutomationSetting, WhatsAppConnection, EligibilityBreakdown };

// ---------------------------------------------------------------------------
// Automation settings
// ---------------------------------------------------------------------------

export async function getWinBackAutomationSetting(
  tenant: TenantContext,
): Promise<AutomationSetting | null> {
  return prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: tenant.businessId, type: "win_back" } },
  });
}

// ---------------------------------------------------------------------------
// WhatsApp connection
// ---------------------------------------------------------------------------

export async function getWhatsAppConnection(
  tenant: TenantContext,
): Promise<WhatsAppConnection | null> {
  return prisma.whatsAppConnection.findUnique({
    where: { businessId: tenant.businessId },
  });
}

// ---------------------------------------------------------------------------
// Automation runs
// ---------------------------------------------------------------------------

export async function getLastWinBackRun(
  tenant: TenantContext,
): Promise<AutomationRun | null> {
  return prisma.automationRun.findFirst({
    where: { businessId: tenant.businessId, type: "win_back" },
    orderBy: { startedAt: "desc" },
  });
}

export interface WinBackStats {
  /** Messages actually delivered by a real provider (not dev mock) */
  realSentThisMonth: number;
  /** Dev-mock test runs (skipped = not real sends) */
  mockRunsThisMonth: number;
  /** Failed real send attempts */
  failedThisMonth: number;
  /** Skipped for ineligibility reasons (invalid phone, etc.) */
  skippedThisMonth: number;
  /** @deprecated Use realSentThisMonth. Kept for backwards compat with older UI callers. */
  sentThisMonth: number;
}

export async function getWinBackStatsThisMonth(
  tenant: TenantContext,
): Promise<WinBackStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [realSentThisMonth, failedThisMonth, mockRunsThisMonth, skippedThisMonth] =
    await Promise.all([
      // Real sends: status delivered/read/sent AND NOT the dev mock skip reason
      prisma.automationMessage.count({
        where: {
          businessId: tenant.businessId,
          type: "win_back",
          status: { in: ["sent", "delivered", "read"] },
          createdAt: { gte: monthStart },
        },
      }),
      prisma.automationMessage.count({
        where: {
          businessId: tenant.businessId,
          type: "win_back",
          status: "failed",
          createdAt: { gte: monthStart },
        },
      }),
      // Dev mock skips (skipped with the exact dev mock reason)
      prisma.automationMessage.count({
        where: {
          businessId: tenant.businessId,
          type: "win_back",
          status: "skipped",
          failureReason: DEV_MOCK_SKIP_REASON,
          createdAt: { gte: monthStart },
        },
      }),
      // Other skips (invalid phone, etc.)
      prisma.automationMessage.count({
        where: {
          businessId: tenant.businessId,
          type: "win_back",
          status: "skipped",
          NOT: { failureReason: DEV_MOCK_SKIP_REASON },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

  return {
    realSentThisMonth,
    mockRunsThisMonth,
    failedThisMonth,
    skippedThisMonth,
    // Backwards compat alias
    sentThisMonth: realSentThisMonth,
  };
}

export interface WinBackAutomationData {
  setting: AutomationSetting | null;
  connection: WhatsAppConnection | null;
  lastRun: AutomationRun | null;
  stats: WinBackStats;
  eligibleCount: number;
  breakdown: EligibilityBreakdown | null;
  /** True when ENABLE_REAL_WHATSAPP_SEND=true (env-wide flag) */
  realSendEnabled: boolean;
  /** True when Meta credentials are present in env (server-side check) */
  credentialsConfigured: boolean;
  /** True when WHATSAPP_TEST_MODE=true */
  testModeActive: boolean;
  /** True when WHATSAPP_TEST_PHONE is set */
  testPhoneConfigured: boolean;
  /** True when a sandbox test send has been successfully confirmed (testSendPassedAt is set) */
  sandboxTestPassed: boolean;
  /** True when META_WHATSAPP_PHONE_NUMBER_ID is configured (real business phone registered with Meta) */
  hasRealBusinessPhone: boolean;
}

export async function getWinBackAutomationData(
  tenant: TenantContext,
): Promise<WinBackAutomationData> {
  const realSendEnabled = process.env.ENABLE_REAL_WHATSAPP_SEND === "true";
  const credentialsConfigured = isRealSendConfigured();
  const testModeActive = isTestModeActive();
  const testPhoneConfigured = isTestPhoneConfigured();
  const hasRealBusinessPhone = !!process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  const [setting, connection, lastRun, stats] = await Promise.all([
    getWinBackAutomationSetting(tenant),
    getWhatsAppConnection(tenant),
    getLastWinBackRun(tenant),
    getWinBackStatsThisMonth(tenant),
  ]);

  const sandboxTestPassed = !!setting?.testSendPassedAt;

  if (!setting) {
    return {
      setting,
      connection,
      lastRun,
      stats,
      eligibleCount: 0,
      breakdown: null,
      realSendEnabled,
      credentialsConfigured,
      testModeActive,
      testPhoneConfigured,
      sandboxTestPassed,
      hasRealBusinessPhone,
    };
  }

  const options = {
    thresholdDays: setting.thresholdDays,
    cooldownDays: setting.cooldownDays,
    requireOptIn: setting.requireOptIn,
  };

  const [eligible, breakdown] = await Promise.all([
    getEligibleClients(tenant, options),
    getEligibilityBreakdown(tenant, options),
  ]);

  return {
    setting,
    connection,
    lastRun,
    stats,
    eligibleCount: eligible.length,
    breakdown,
    realSendEnabled,
    credentialsConfigured,
    testModeActive,
    testPhoneConfigured,
    sandboxTestPassed,
    hasRealBusinessPhone,
  };
}

// ---------------------------------------------------------------------------
// Admin queries
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Manual send history
// ---------------------------------------------------------------------------

export interface AdminManualSendEntry {
  id: string;
  createdAt: Date;
  clientId: string;
  clientName: string;
  /** AutomationType as string */
  type: string;
  /** source: manual_owner | manual_admin */
  source: string | null;
  /** status: queued | sent | delivered | read | failed | skipped */
  status: string;
  providerMessageId: string | null;
  failureReason: string | null;
  /** Masked phone stored at send time */
  maskedPhone: string;
  templateId: string | null;
  sentAt: Date | null;
}

function maskPhoneForLog(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "***";
  return d.slice(0, 3) + "***" + d.slice(-3);
}

export async function getAdminLastManualSends(
  businessId: string,
  limit = 5,
): Promise<AdminManualSendEntry[]> {
  const msgs = await prisma.automationMessage.findMany({
    where: {
      businessId,
      source: { in: ["manual_owner", "manual_admin"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      clientId: true,
      type: true,
      source: true,
      status: true,
      providerMessageId: true,
      failureReason: true,
      phone: true,
      templateId: true,
      sentAt: true,
      client: { select: { fullName: true } },
    },
  });

  return msgs.map((m) => ({
    id: m.id,
    createdAt: m.createdAt,
    clientId: m.clientId,
    clientName: m.client.fullName,
    type: m.type,
    source: m.source,
    status: m.status,
    providerMessageId: m.providerMessageId,
    failureReason: m.failureReason,
    maskedPhone: maskPhoneForLog(m.phone),
    templateId: m.templateId,
    sentAt: m.sentAt,
  }));
}

async function getManualSentThisMonth(businessId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return prisma.automationMessage.count({
    where: {
      businessId,
      source: { in: ["manual_owner", "manual_admin"] },
      status: { in: ["sent", "delivered", "read"] },
      createdAt: { gte: monthStart },
    },
  });
}

export interface AdminAutomationInfo {
  whatsappConnected: boolean;
  provider: string | null;
  phoneNumber: string | null;
  automationEnabled: boolean;
  realSendEnabled: boolean;
  credentialsConfigured: boolean;
  templateConfigured: boolean;
  realSentThisMonth: number;
  mockRunsThisMonth: number;
  failedThisMonth: number;
  skippedThisMonth: number;
  /** Manual sends (manual_owner / manual_admin) that reached sent/delivered/read this month */
  manualSentThisMonth: number;
  /** Up to 5 most recent manual send attempts */
  lastManualSends: AdminManualSendEntry[];
  lastRunAt: Date | null;
  lastFailureReason: string | null;
  /** Timestamp of the last webhook event received from Meta */
  lastWebhookReceivedAt: Date | null;
  /** Timestamp of the last delivery status event from webhook */
  lastDeliveryEventAt: Date | null;
  /** Timestamp of the last read status event from webhook */
  lastReadEventAt: Date | null;
}

export async function getAdminAutomationInfo(
  businessId: string,
): Promise<AdminAutomationInfo> {
  const tenant = { businessId };
  const [connection, setting, stats, lastRun, lastFailedMsg, manualSentThisMonth, lastManualSends] =
    await Promise.all([
      getWhatsAppConnection(tenant),
      getWinBackAutomationSetting(tenant),
      getWinBackStatsThisMonth(tenant),
      getLastWinBackRun(tenant),
      prisma.automationMessage.findFirst({
        where: { businessId, status: "failed" },
        orderBy: { createdAt: "desc" },
        select: { failureReason: true },
      }),
      getManualSentThisMonth(businessId),
      getAdminLastManualSends(businessId, 5),
    ]);

  return {
    whatsappConnected: connection?.status === "active",
    provider: connection?.provider ?? null,
    phoneNumber: connection?.phoneNumber ?? null,
    automationEnabled: setting?.enabled ?? false,
    realSendEnabled: process.env.ENABLE_REAL_WHATSAPP_SEND === "true",
    credentialsConfigured: isRealSendConfigured(),
    templateConfigured: !!setting?.templateName,
    realSentThisMonth: stats.realSentThisMonth,
    mockRunsThisMonth: stats.mockRunsThisMonth,
    failedThisMonth: stats.failedThisMonth,
    skippedThisMonth: stats.skippedThisMonth,
    manualSentThisMonth,
    lastManualSends,
    lastRunAt: lastRun?.startedAt ?? null,
    lastFailureReason: lastFailedMsg?.failureReason ?? null,
    lastWebhookReceivedAt: connection?.lastWebhookReceivedAt ?? null,
    lastDeliveryEventAt: connection?.lastDeliveryEventAt ?? null,
    lastReadEventAt: connection?.lastReadEventAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Message history for a client
// ---------------------------------------------------------------------------

export async function getClientWinBackMessages(
  tenant: TenantContext,
  clientId: string,
): Promise<AutomationMessage[]> {
  return prisma.automationMessage.findMany({
    where: {
      businessId: tenant.businessId,
      clientId,
      type: "win_back",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
