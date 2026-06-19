import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { runMorningReminderForBusiness } from "@/server/morning-reminder/runner";
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const israelHour = parseInt(
    new Intl.DateTimeFormat("he-IL", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(now),
    10,
  );

  logger.info("[cron.morning-reminder] starting", { israelHour });

  // Fetch all enabled settings. The runner applies the hour filter per-business.
  const allEnabled = await prisma.automationSetting.findMany({
    where: { type: "morning_reminder", enabled: true },
    select: { businessId: true, sendHour: true, thresholdDays: true, messageTemplate: true, requireOptIn: true, templateName: true, templateLanguage: true },
  });

  // Pre-filter: for fixed-hour mode only include businesses scheduled this hour.
  // Relative-mode (sendHour < 0) fires every hour and relies on appointment window.
  const eligibleSettings = allEnabled.filter(({ sendHour }) =>
    sendHour >= 0 ? sendHour === israelHour : true,
  );

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const setting of eligibleSettings) {
    try {
      const result = await runMorningReminderForBusiness({
        businessId: setting.businessId,
        sendHour: setting.sendHour,
        thresholdDays: setting.thresholdDays,
        messageTemplate: setting.messageTemplate,
        requireOptIn: setting.requireOptIn,
        templateName: setting.templateName,
        templateLanguage: setting.templateLanguage,
        bypassHourCheck: false,
        now,
      });
      totalSent += result.sentCount;
      totalSkipped += result.skippedCount;
      totalFailed += result.failedCount;
    } catch (err) {
      captureError("cron.morning-reminder", err, { businessId: setting.businessId });
      totalFailed++;
    }
  }

  logger.info("[cron.morning-reminder] done", {
    sent: totalSent,
    skipped: totalSkipped,
    failed: totalFailed,
  });
  return NextResponse.json({
    hour: israelHour,
    businessesChecked: eligibleSettings.length,
    sent: totalSent,
    skipped: totalSkipped,
    failed: totalFailed,
  });
}
