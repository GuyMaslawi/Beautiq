import { NextResponse } from "next/server";
import { processDueCampaigns } from "@/server/whatsapp/campaigns/processor";
import { logger, captureError } from "@/lib/logger";

// Cron backstop for bulk WhatsApp campaigns. Owner-driven sending drives most
// progress in real time; this tick keeps queued campaigns moving (and processes
// retries) even when no owner tab is open. Protected by CRON_SECRET exactly like
// the other cron routes; runs every 10 minutes (vercel.json).
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Process one bounded batch per due campaign. The per-campaign lock inside
    // processCampaignBatch guarantees this never overlaps with owner-driven sends.
    const result = await processDueCampaigns({ maxCampaigns: 10 });
    logger.info("[cron.whatsapp-campaigns] done", { processed: result.processed });
    return NextResponse.json({ processed: result.processed });
  } catch (err) {
    captureError("cron.whatsapp-campaigns", err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
