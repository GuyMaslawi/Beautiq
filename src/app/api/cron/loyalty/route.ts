import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import {
  withTransientDbRetry,
  isTransientDbError,
  getPrismaErrorCode,
} from "@/server/db/retry";
import { runLoyaltyForBusiness } from "@/server/loyalty/runner";
import { logger, captureError } from "@/lib/logger";

// Vercel cron invokes this with GET, protected by CRON_SECRET (Bearer header).
// Loyalty milestones are event-driven, not time-of-day-driven, so this runs on a
// steady interval and messages any client who has just crossed a boundary. The
// LoyaltyMessage unique index dedups, so re-running is always safe.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("[cron.loyalty] starting");

  const fetchPrograms = () =>
    prisma.loyaltyProgram.findMany({
      where: { isActive: true, autoSendEnabled: true },
      select: { businessId: true },
    });

  let programs: Awaited<ReturnType<typeof fetchPrograms>>;
  try {
    programs = await withTransientDbRetry("cron.loyalty", fetchPrograms);
  } catch (err) {
    if (isTransientDbError(err)) {
      logger.error("[cron.loyalty] database unreachable after retries", {
        cron: "cron.loyalty",
        prismaCode: getPrismaErrorCode(err),
        errMessage: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }
    throw err;
  }

  if (programs.length === 0) {
    logger.info("[cron.loyalty] no active auto-send programs");
    return NextResponse.json({ processed: 0 });
  }

  const businesses = await prisma.business.findMany({
    where: { id: { in: programs.map((p) => p.businessId) } },
    select: { id: true, name: true },
  });

  const results: Array<{
    businessId: string;
    success: boolean;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    error?: string;
  }> = [];

  for (const business of businesses) {
    try {
      const result = await runLoyaltyForBusiness(business);
      results.push({ businessId: business.id, ...result });
    } catch (err) {
      captureError("cron.loyalty", err, { businessId: business.id });
      results.push({
        businessId: business.id,
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

  logger.info("[cron.loyalty] done", {
    processed: businesses.length,
    totalSent,
    totalFailed,
  });

  return NextResponse.json({
    processed: businesses.length,
    totalSent,
    totalFailed,
    results,
  });
}
