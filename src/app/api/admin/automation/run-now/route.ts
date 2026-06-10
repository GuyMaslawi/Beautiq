import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { runWinBackForBusiness } from "@/server/win-back-automation/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/automation/run-now
 *
 * Platform-admin-only endpoint for forcing an immediate win-back automation
 * run without waiting for the scheduled cron hour.
 *
 * Body (optional JSON):
 *   { "businessId": "..." }   — run for a specific business
 *   {}                        — run for ALL businesses with automation enabled
 *
 * The sendHour hour-filter is intentionally bypassed here so admins can
 * trigger a run at any time for testing and verification purposes.
 * All other safeguards (cooldown, opt-in, test mode, real-send flag) remain
 * fully active — this endpoint delegates to the same runner.ts used by the
 * cron job.
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

  // Resolve target businesses
  let businesses: Array<{ id: string; name: string; slug: string }>;

  if (bodyBusinessId) {
    const biz = await prisma.business.findUnique({
      where: { id: bodyBusinessId },
      select: { id: true, name: true, slug: true },
    });
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    businesses = [biz];
  } else {
    // All businesses with win-back automation enabled
    const settings = await prisma.automationSetting.findMany({
      where: { type: "win_back", enabled: true },
      select: { businessId: true },
    });
    const ids = settings.map((s) => s.businessId);
    businesses = await prisma.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true },
    });
  }

  console.log(
    `[admin/automation/run-now] triggered by adminId=${user.id} — businesses=${businesses.length}`,
  );

  const results: Array<{
    businessId: string;
    businessName: string;
    success: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    mockSkipCount: number;
    runId?: string;
    error?: string;
  }> = [];

  for (const business of businesses) {
    try {
      const result = await runWinBackForBusiness(business);
      results.push({ businessId: business.id, businessName: business.name, ...result });
    } catch (err) {
      console.error(
        `[admin/automation/run-now] error — businessId=${business.id}`,
        err,
      );
      results.push({
        businessId: business.id,
        businessName: business.name,
        success: false,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        mockSkipCount: 0,
        error: String(err),
      });
    }
  }

  const totalSent = results.reduce((s, r) => s + r.sentCount, 0);
  const totalFailed = results.reduce((s, r) => s + r.failedCount, 0);
  const totalMock = results.reduce((s, r) => s + r.mockSkipCount, 0);

  return NextResponse.json({
    processed: businesses.length,
    totalSent,
    totalFailed,
    totalMock,
    results,
  });
}
