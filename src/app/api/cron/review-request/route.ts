import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { runReviewRequestForBusiness } from "@/server/review-request/runner";
import { logger, captureError } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("[cron.review-request] starting");

  const now = new Date();

  const eligibleSettings = await prisma.automationSetting.findMany({
    where: { type: "review_request", enabled: true },
    select: { businessId: true, offerValue: true, messageTemplate: true, sendHour: true, requireOptIn: true, templateName: true, templateLanguage: true },
  });

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const setting of eligibleSettings) {
    try {
      const result = await runReviewRequestForBusiness({
        businessId: setting.businessId,
        reviewLink: setting.offerValue,
        messageTemplate: setting.messageTemplate,
        sendHour: setting.sendHour,
        requireOptIn: setting.requireOptIn,
        templateName: setting.templateName,
        templateLanguage: setting.templateLanguage,
        bypassTiming: false,
        now,
      });
      totalSent += result.sentCount;
      totalSkipped += result.skippedCount;
      totalFailed += result.failedCount;
    } catch (err) {
      captureError("cron.review-request", err, { businessId: setting.businessId });
      totalFailed++;
    }
  }

  logger.info("[cron.review-request] done", {
    sent: totalSent,
    skipped: totalSkipped,
    failed: totalFailed,
  });
  return NextResponse.json({
    businessesChecked: eligibleSettings.length,
    sent: totalSent,
    skipped: totalSkipped,
    failed: totalFailed,
  });
}
