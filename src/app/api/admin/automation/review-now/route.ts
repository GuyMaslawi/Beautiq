import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { runReviewRequestForBusiness } from "@/server/review-request/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/automation/review-now
 *
 * Platform-admin-only endpoint for forcing an immediate review-request run
 * without waiting for the normal timing window.
 *
 * Body (optional JSON):
 *   { "businessId": "..." }   — run for a specific business
 *   {}                        — run for ALL businesses with the automation enabled
 *
 * The timing window is widened to 7 days back so admins can test even for
 * bookings completed outside the normal delivery window. All other safeguards
 * (dedup via reviewRequestSentAt, phone validation, provider) remain active.
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
    // no body — run all
  }

  let targetSettings: Array<{
    businessId: string;
    offerValue: string | null;
    messageTemplate: string | null;
    sendHour: number;
    requireOptIn: boolean;
    templateName: string | null;
    templateLanguage: string | null;
  }>;

  if (bodyBusinessId) {
    const setting = await prisma.automationSetting.findUnique({
      where: { businessId_type: { businessId: bodyBusinessId, type: "review_request" } },
      select: { businessId: true, offerValue: true, messageTemplate: true, sendHour: true, requireOptIn: true, templateName: true, templateLanguage: true },
    });
    targetSettings = setting
      ? [setting]
      : [{ businessId: bodyBusinessId, offerValue: null, messageTemplate: null, sendHour: 10, requireOptIn: false, templateName: null, templateLanguage: null }];
  } else {
    targetSettings = await prisma.automationSetting.findMany({
      where: { type: "review_request", enabled: true },
      select: { businessId: true, offerValue: true, messageTemplate: true, sendHour: true, requireOptIn: true, templateName: true, templateLanguage: true },
    });
  }

  console.log(
    `[admin/review-now] triggered by adminId=${user.id} — businesses=${targetSettings.length}`,
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
      const result = await runReviewRequestForBusiness({
        businessId: setting.businessId,
        reviewLink: setting.offerValue,
        messageTemplate: setting.messageTemplate,
        sendHour: setting.sendHour,
        requireOptIn: setting.requireOptIn,
        templateName: setting.templateName,
        templateLanguage: setting.templateLanguage,
        bypassTiming: true,
      });
      results.push({ businessId: setting.businessId, ...result });
    } catch (err) {
      console.error(`[admin/review-now] error — businessId=${setting.businessId}`, err);
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
