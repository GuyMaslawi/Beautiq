import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import {
  withTransientDbRetry,
  isTransientDbError,
  getPrismaErrorCode,
} from "@/server/db/retry";
import { runWinBackForBusiness } from "@/server/win-back-automation/runner";
import { logger, captureError } from "@/lib/logger";

// Vercel cron invokes this with GET. The route is protected by CRON_SECRET
// so it must not be publicly callable. Vercel automatically sends
// Authorization: Bearer <CRON_SECRET> when configured in vercel.json.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Auth: verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Current hour in Israel (Asia/Jerusalem) — matches AutomationSetting.sendHour
  const israelHour = parseInt(
    new Intl.DateTimeFormat("he-IL", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(new Date()),
    10,
  );

  logger.info("[cron.win-back] starting", { israelHour });

  // Load all businesses that have automation enabled at this hour and have
  // an active WhatsApp connection.
  // First DB touch after cold start — retried on transient connection errors (P1001 etc.).
  const fetchEligibleSettings = () =>
    prisma.automationSetting.findMany({
      where: {
        type: "win_back",
        enabled: true,
        sendHour: israelHour,
      },
      select: { businessId: true },
    });

  let eligibleSettings: Awaited<ReturnType<typeof fetchEligibleSettings>>;
  try {
    eligibleSettings = await withTransientDbRetry("cron.win-back", fetchEligibleSettings);
  } catch (err) {
    if (isTransientDbError(err)) {
      logger.error("[cron.win-back] database unreachable after retries", {
        cron: "cron.win-back",
        prismaCode: getPrismaErrorCode(err),
        errMessage: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }
    throw err;
  }

  if (eligibleSettings.length === 0) {
    logger.info("[cron.win-back] no businesses scheduled this hour", { israelHour });
    return NextResponse.json({ processed: 0, hour: israelHour });
  }

  const businessIds = eligibleSettings.map((s) => s.businessId);

  // Filter to businesses with an active WhatsApp connection
  const activeConnections = await prisma.whatsAppConnection.findMany({
    where: {
      businessId: { in: businessIds },
      status: "active",
    },
    select: { businessId: true },
  });
  const activeBusinessIds = new Set(activeConnections.map((c) => c.businessId));

  // Load business details for active ones
  const businesses = await prisma.business.findMany({
    where: { id: { in: [...activeBusinessIds] } },
    select: { id: true, name: true, slug: true },
  });

  logger.info("[cron.win-back] eligible businesses resolved", {
    israelHour,
    scheduled: eligibleSettings.length,
    active: businesses.length,
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
      // Guard: skip if a run already completed or is running today for this business
      // (prevents double-execution if the cron fires twice in the same hour window)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existingRun = await prisma.automationRun.findFirst({
        where: {
          businessId: business.id,
          type: "win_back",
          startedAt: { gte: todayStart },
          status: { in: ["running", "completed", "partial"] },
        },
      });

      if (existingRun) {
        logger.info("[cron.win-back] skipping — run already exists today", {
          businessId: business.id,
          runId: existingRun.id,
        });
        results.push({
          businessId: business.id,
          success: true,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
          error: "run already completed today",
        });
        continue;
      }

      const result = await runWinBackForBusiness(business);
      results.push({ businessId: business.id, ...result });
    } catch (err) {
      captureError("cron.win-back", err, { businessId: business.id });
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

  logger.info("[cron.win-back] done", {
    processed: businesses.length,
    totalSent,
    totalFailed,
  });

  return NextResponse.json({
    hour: israelHour,
    processed: businesses.length,
    totalSent,
    totalFailed,
    results,
  });
}
