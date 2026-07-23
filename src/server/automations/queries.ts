import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";

/** Lightweight count for the dashboard attention card */
export async function getRemindersDueCount(
  tenant: TenantContext,
): Promise<number> {
  // Only show the dashboard reminder card when the morning-reminder automation is actually enabled.
  // The old reminders table is a legacy model — the current system writes reminderSentAt directly
  // on the Booking row, so we query that instead.
  const automationSetting = await prisma.automationSetting.findUnique({
    where: {
      businessId_type: {
        businessId: tenant.businessId,
        type: "morning_reminder",
      },
    },
    select: { enabled: true },
  });

  if (!automationSetting?.enabled) return 0;

  const now = new Date();
  // Show bookings in the next 24 hours that haven't had a reminder sent yet
  const windowEnd = new Date(now.getTime() + 24 * 3600 * 1000);

  return prisma.booking.count({
    where: {
      businessId: tenant.businessId,
      startTime: { gte: now, lte: windowEnd },
      status: { in: ["pending", "approved"] },
      reminderSentAt: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Recent automation activity (read-only) — surfaces the existing AutomationRun
// audit trail for the dashboard "אוטומציות" section. No new behaviour.
// ---------------------------------------------------------------------------

export interface RecentAutomationRun {
  id: string;
  type: string;
  status: string;
  sentCount: number;
  startedAtISO: string;
}

export async function getRecentAutomationRuns(
  tenant: TenantContext,
  limit = 3,
): Promise<RecentAutomationRun[]> {
  const runs = await prisma.automationRun.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      sentCount: true,
      startedAt: true,
    },
  });

  return runs.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    sentCount: r.sentCount,
    startedAtISO: r.startedAt.toISOString(),
  }));
}
