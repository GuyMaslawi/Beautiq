import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import type { AutomationSetting, AutomationRun } from "@prisma/client";

export async function getMorningReminderSetting(
  tenant: TenantContext,
): Promise<AutomationSetting | null> {
  return prisma.automationSetting.findUnique({
    where: { businessId_type: { businessId: tenant.businessId, type: "morning_reminder" } },
  });
}

export interface MorningReminderStats {
  sentThisMonth: number;
}

export async function getMorningReminderStatsThisMonth(
  tenant: TenantContext,
): Promise<MorningReminderStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sentThisMonth = await prisma.booking.count({
    where: {
      businessId: tenant.businessId,
      reminderSentAt: { gte: monthStart },
    },
  });

  return { sentThisMonth };
}

export async function getLastMorningReminderRun(
  tenant: TenantContext,
): Promise<AutomationRun | null> {
  return prisma.automationRun.findFirst({
    where: { businessId: tenant.businessId, type: "morning_reminder" },
    orderBy: { startedAt: "desc" },
  });
}
