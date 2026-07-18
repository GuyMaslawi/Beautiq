/**
 * Durable campaign processor.
 *
 * Sends a campaign to its snapshotted recipients in small batches, through the
 * SAME per-business resolver + Meta Cloud API sender used everywhere else. It is
 * called both by an owner-driven server action (for immediate progress) and by a
 * cron backstop — a per-campaign lock guarantees only one worker sends a given
 * campaign at a time, so overlapping runs never double-send.
 *
 * Guarantees:
 *   • Recipients already accepted by Meta (have a wamid) are NEVER re-sent —
 *     only status="queued" rows are ever selected.
 *   • Suppression (unsubscribe / opt-in / valid phone) is re-checked from the
 *     live scoped Client immediately before each send.
 *   • Progress is persisted after every recipient, so a crash resumes cleanly.
 *   • One recipient failure never aborts the batch.
 */

import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import { isValidIsraeliPhone } from "@/lib/phone";
import { WA_CAMPAIGNS } from "@/lib/constants/whatsapp-campaigns";
import {
  getMarketingCampaignTemplate,
  buildCampaignVariables,
  renderCampaignPreview,
} from "./template";

/** Recipients processed per batch — bounded so no single request/cron tick runs long. */
const BATCH_SIZE = 20;
/** A lock older than this is considered abandoned (crashed worker) and reclaimable. */
const LOCK_STALE_MS = 5 * 60 * 1000;

export interface CampaignCounts {
  total: number;
  queued: number;
  processing: number;
  accepted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
}

export interface CampaignProgress {
  campaignId: string;
  status: string;
  done: boolean;
  /** True when another worker holds the lock and this call did no work. */
  busy: boolean;
  processedThisBatch: number;
  counts: CampaignCounts;
}

const EMPTY_COUNTS: CampaignCounts = {
  total: 0,
  queued: 0,
  processing: 0,
  accepted: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  skipped: 0,
};

export async function getCampaignCounts(campaignId: string): Promise<CampaignCounts> {
  const groups = await prisma.whatsAppCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const counts: CampaignCounts = { ...EMPTY_COUNTS };
  for (const g of groups) {
    const n = g._count._all;
    counts.total += n;
    (counts as unknown as Record<string, number>)[g.status] = n;
  }
  return counts;
}

/**
 * Finalize a campaign once no queued recipients remain. Guarded to only affect a
 * campaign still in queued/processing (so it never overrides a cancellation).
 */
async function finalizeIfDrained(campaignId: string): Promise<string | null> {
  const remaining = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId, status: { in: ["queued", "processing"] } },
  });
  if (remaining > 0) return null;

  const failed = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId, status: "failed" },
  });
  const finalStatus = failed > 0 ? "completed_with_errors" : "completed";

  await prisma.whatsAppCampaign.updateMany({
    where: { id: campaignId, status: { in: ["queued", "processing"] } },
    data: { status: finalStatus, lockedAt: null, completedAt: new Date() },
  });
  return finalStatus;
}

/**
 * Process one batch for a single campaign. Acquires the per-campaign lock; if it
 * cannot (another worker is active), returns immediately with busy=true.
 */
export async function processCampaignBatch(
  campaignId: string,
  businessId: string,
  opts?: { batchSize?: number },
): Promise<CampaignProgress> {
  const batchSize = opts?.batchSize ?? BATCH_SIZE;
  const staleThreshold = new Date(Date.now() - LOCK_STALE_MS);

  // Atomically claim the lock: only one worker can move queued/processing → locked.
  const claim = await prisma.whatsAppCampaign.updateMany({
    where: {
      id: campaignId,
      businessId,
      status: { in: ["queued", "processing"] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleThreshold } }],
    },
    data: { status: "processing", lockedAt: new Date() },
  });

  if (claim.count === 0) {
    // Either terminal, wrong tenant, or another worker holds a fresh lock.
    const campaign = await prisma.whatsAppCampaign.findFirst({
      where: { id: campaignId, businessId },
      select: { status: true },
    });
    const counts = campaign ? await getCampaignCounts(campaignId) : { ...EMPTY_COUNTS };
    const terminal =
      !campaign || ["completed", "completed_with_errors", "cancelled"].includes(campaign.status);
    return {
      campaignId,
      status: campaign?.status ?? "cancelled",
      done: terminal,
      busy: !terminal,
      processedThisBatch: 0,
      counts,
    };
  }

  // Stamp startedAt on first processing.
  await prisma.whatsAppCampaign.updateMany({
    where: { id: campaignId, startedAt: null },
    data: { startedAt: new Date() },
  });

  try {
    const queued = await prisma.whatsAppCampaignRecipient.findMany({
      where: { campaignId, status: "queued" },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: { id: true, clientId: true },
    });

    if (queued.length === 0) {
      const finalStatus = await finalizeIfDrained(campaignId);
      await releaseLock(campaignId);
      const counts = await getCampaignCounts(campaignId);
      return {
        campaignId,
        status: finalStatus ?? "processing",
        done: true,
        busy: false,
        processedThisBatch: 0,
        counts,
      };
    }

    const [business, template, provider] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
      getMarketingCampaignTemplate(businessId),
      getWhatsAppProviderForBusiness(businessId),
    ]);

    const businessName = business?.name ?? "";
    const payload = (await getCampaignPayload(campaignId)) ?? undefined;

    // One AutomationRun groups this batch's message log rows (audit trail).
    const run = await prisma.automationRun.create({
      data: {
        businessId,
        type: "manual",
        status: "running",
        eligibleCount: queued.length,
      },
    });

    const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";
    const testPhone = process.env.WHATSAPP_TEST_PHONE;

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const recipient of queued) {
      processed++;
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "processing" },
      });

      // Re-resolve the live client, scoped to the business, and re-check
      // suppression immediately before sending. Never trust the snapshot.
      const client = await prisma.client.findFirst({
        where: { id: recipient.clientId, businessId },
        select: {
          fullName: true,
          normalizedPhone: true,
          unsubscribedAt: true,
        },
      });

      const skip = (reason: string) =>
        prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "skipped", skipReason: reason },
        });

      if (!client) {
        await skip(WA_CAMPAIGNS.reasons.blocked);
        skipped++;
        continue;
      }
      if (!client.normalizedPhone || !isValidIsraeliPhone(client.normalizedPhone)) {
        await skip(WA_CAMPAIGNS.reasons.invalid_phone);
        skipped++;
        continue;
      }
      if (client.unsubscribedAt) {
        await skip(WA_CAMPAIGNS.reasons.unsubscribed);
        skipped++;
        continue;
      }

      const templateVariables = buildCampaignVariables(template, {
        clientFullName: client.fullName,
        businessName,
        payload,
      });
      const messageText = renderCampaignPreview(template, templateVariables);

      // Test mode redirects every send to the designated test phone.
      const recipientPhone =
        isTestMode && testPhone ? testPhone : client.normalizedPhone;

      const message = await prisma.automationMessage.create({
        data: {
          businessId,
          runId: run.id,
          clientId: recipient.clientId,
          type: "manual",
          phone: recipientPhone,
          messageText,
          templateId: template.name,
          templateLanguage: template.language,
          status: "queued",
          source: "campaign",
        },
      });

      const result = await provider.send({
        businessId,
        toPhone: recipientPhone,
        templateId: template.name,
        templateLanguage: template.language,
        templateVariables,
        fallbackText: messageText,
        automationRunId: run.id,
        clientId: recipient.clientId,
      });

      if (result.isMockSkip || result.isTestModeBlock) {
        const reason = result.isMockSkip ? DEV_MOCK_SKIP_REASON : TEST_MODE_BLOCKED_REASON;
        await prisma.automationMessage.update({
          where: { id: message.id },
          data: { status: "skipped", failureReason: reason },
        });
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "skipped", skipReason: reason, automationMessageId: message.id },
        });
        skipped++;
      } else if (result.success && result.providerMessageId) {
        await prisma.automationMessage.update({
          where: { id: message.id },
          data: {
            status: "sent",
            providerMessageId: result.providerMessageId,
            phoneNumberId: result.phoneNumberIdUsed ?? undefined,
            sentAt: new Date(),
          },
        });
        // "accepted" = Meta returned a wamid. Webhook advances to sent/delivered/read.
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "accepted",
            metaMessageId: result.providerMessageId,
            automationMessageId: message.id,
            acceptedAt: new Date(),
          },
        });
        sent++;
      } else {
        await prisma.automationMessage.update({
          where: { id: message.id },
          data: {
            status: "failed",
            failureReason: result.failureReason,
            failedAt: new Date(),
            phoneNumberId: result.phoneNumberIdUsed ?? undefined,
            errorCode: result.metaError?.code ?? undefined,
            errorSubcode: result.metaError?.subcode ?? undefined,
            errorType: result.metaError?.type ?? undefined,
            errorFbtraceId: result.metaError?.fbtraceId ?? undefined,
            errorRaw: result.metaError?.rawSanitized ?? undefined,
          },
        });
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "failed",
            automationMessageId: message.id,
            errorCode: result.metaError?.code ?? undefined,
            errorSubcode: result.metaError?.subcode ?? undefined,
            errorMessage: result.failureReason ?? undefined,
            failedAt: new Date(),
          },
        });
        failed++;
      }
    }

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: failed > 0 && sent === 0 ? "failed" : "completed",
        finishedAt: new Date(),
        sentCount: sent,
        failedCount: failed,
        skippedCount: skipped,
      },
    });

    await releaseLock(campaignId);
    const finalStatus = await finalizeIfDrained(campaignId);
    const counts = await getCampaignCounts(campaignId);

    return {
      campaignId,
      status: finalStatus ?? "processing",
      done: finalStatus !== null,
      busy: false,
      processedThisBatch: processed,
      counts,
    };
  } catch (err) {
    // Release the lock so the campaign is not wedged; re-throw for the caller/log.
    await releaseLock(campaignId);
    throw err;
  }
}

/** Owner-supplied variable payload (e.g. offer text) for the campaign. */
async function getCampaignPayload(
  campaignId: string,
): Promise<Record<string, string> | null> {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: campaignId },
    select: { variablePayload: true },
  });
  const payload = campaign?.variablePayload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, string>;
  }
  return null;
}

async function releaseLock(campaignId: string): Promise<void> {
  await prisma.whatsAppCampaign.updateMany({
    where: { id: campaignId, status: "processing" },
    data: { lockedAt: null },
  });
}

/**
 * Cron backstop: process one batch for each campaign that still has work. Bounded
 * so a single cron tick stays within the function time limit. Failures on one
 * campaign never stop the others.
 */
export async function processDueCampaigns(opts?: {
  maxCampaigns?: number;
  batchSize?: number;
}): Promise<{ processed: number; results: CampaignProgress[] }> {
  const maxCampaigns = opts?.maxCampaigns ?? 10;
  const staleThreshold = new Date(Date.now() - LOCK_STALE_MS);

  const due = await prisma.whatsAppCampaign.findMany({
    where: {
      status: { in: ["queued", "processing"] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleThreshold } }],
    },
    orderBy: { createdAt: "asc" },
    take: maxCampaigns,
    select: { id: true, businessId: true },
  });

  const results: CampaignProgress[] = [];
  for (const campaign of due) {
    try {
      const progress = await processCampaignBatch(campaign.id, campaign.businessId, opts);
      results.push(progress);
    } catch (err) {
      console.error(
        `[whatsapp-campaign] batch failed — campaignId=${campaign.id} err=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { processed: results.length, results };
}
