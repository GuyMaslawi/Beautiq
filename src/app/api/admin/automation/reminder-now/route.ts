import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { runMorningReminderForBusiness } from "@/server/morning-reminder/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/automation/reminder-now
 *
 * Platform-admin-only endpoint for forcing an immediate morning-reminder run
 * without waiting for the scheduled cron hour.
 *
 * Body (optional JSON):
 *   { "businessId": "..." }   — run for a specific business
 *   {}                        — run for ALL businesses with the automation enabled
 *
 * The sendHour filter and idempotency guard are intentionally bypassed so admins
 * can trigger a run at any time for testing. All other safeguards remain active.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bodyBusinessId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.businessId === "string") {
      bodyBusinessId = body.businessId;
    }
  } catch {
    // no body — run for current user's business
  }

  // Resolve target businesses
  let targetSettings: Array<{
    businessId: string;
    sendHour: number;
    thresholdDays: number;
    messageTemplate: string | null;
  }>;

  if (bodyBusinessId) {
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId: bodyBusinessId, type: "morning_reminder" } },
      select: { businessId: true, sendHour: true, thresholdDays: true, messageTemplate: true },
    });
    if (!setting) {
      // Business has no morning-reminder setting — create a default run with zero bookings
      targetSettings = [{ businessId: bodyBusinessId, sendHour: 9, thresholdDays: 0, messageTemplate: null }];
    } else {
      targetSettings = [setting];
    }
  } else {
    targetSettings = await prisma.automationSetting.findMany({
      where: { type: "morning_reminder", enabled: true },
      select: { businessId: true, sendHour: true, thresholdDays: true, messageTemplate: true },
    });
  }

  console.log(
    `[admin/reminder-now] triggered by adminId=${user.id} — businesses=${targetSettings.length}`,
  );

  const results: Array<{
    businessId: string;
    success: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    runId?: string;
    error?: string;
  }> = [];

  for (const setting of targetSettings) {
    try {
      const result = await runMorningReminderForBusiness({
        businessId: setting.businessId,
        sendHour: setting.sendHour,
        thresholdDays: setting.thresholdDays,
        messageTemplate: setting.messageTemplate,
        bypassHourCheck: true,
      });
      results.push({ businessId: setting.businessId, ...result });
    } catch (err) {
      console.error(`[admin/reminder-now] error — businessId=${setting.businessId}`, err);
      results.push({
        businessId: setting.businessId,
        success: false,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        error: String(err),
      });
    }
  }

  const totalSent = results.reduce((s, r) => s + r.sentCount, 0);
  const totalFailed = results.reduce((s, r) => s + r.failedCount, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skippedCount, 0);

  return NextResponse.json({
    processed: targetSettings.length,
    totalSent,
    totalFailed,
    totalSkipped,
    results,
  });
}
