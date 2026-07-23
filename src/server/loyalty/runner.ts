import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getWhatsAppProviderForBusiness } from "@/server/whatsapp/resolver";
import { renderLoyaltyMessage } from "@/lib/loyalty/messages";
import { LOYALTY_DEFAULTS } from "@/lib/loyalty/constants";
import {
  DEV_MOCK_SKIP_REASON,
  TEST_MODE_BLOCKED_REASON,
} from "@/lib/whatsapp/provider";
import { isValidIsraeliPhone, toWaPhone } from "@/lib/phone";

export interface LoyaltyRunResult {
  success: boolean;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  error?: string;
}

export type MilestoneType = "almost_there" | "reward_earned";

interface Candidate {
  clientId: string;
  fullName: string;
  phone: string;
  completedVisits: number;
  type: MilestoneType;
  milestone: number;
}

/**
 * Decide which milestone message (if any) a client is due right now. Only clients
 * sitting EXACTLY on a boundary qualify, so enabling the feature never back-fills:
 *   • reward_earned — completedVisits is an exact multiple of visitsRequired and
 *     that reward hasn't been redeemed yet (milestone = the reward number, 1-based).
 *   • almost_there  — exactly one visit short of the next reward (milestone = the
 *     0-based index of the card currently being filled).
 * Returns null when the client is mid-card or has no completed visits.
 */
export function classifyLoyaltyMilestone(
  completedVisits: number,
  redeemedRewards: number,
  visitsRequired: number,
): { type: MilestoneType; milestone: number } | null {
  if (completedVisits <= 0 || visitsRequired < 2) return null;
  const earnedRewards = Math.floor(completedVisits / visitsRequired);
  const visitsInCurrentCard = completedVisits % visitsRequired;

  if (visitsInCurrentCard === 0 && earnedRewards > redeemedRewards) {
    return { type: "reward_earned", milestone: earnedRewards };
  }
  if (visitsInCurrentCard === visitsRequired - 1) {
    return { type: "almost_there", milestone: earnedRewards };
  }
  return null;
}

const EMPTY: LoyaltyRunResult = {
  success: true,
  sentCount: 0,
  skippedCount: 0,
  failedCount: 0,
};

/**
 * Core loyalty auto-messaging run — no session/auth dependency (cron-safe).
 *
 * Sends at most one milestone message per client per run:
 *   • reward_earned — the client just completed a card (completedVisits is an exact
 *     multiple of visitsRequired) and that reward hasn't been redeemed yet.
 *   • almost_there  — the client is exactly one visit short of the next reward.
 *
 * Only clients sitting EXACTLY on a boundary are messaged, so enabling the feature
 * never back-fills old milestones. The (business, client, type, milestone) unique
 * index on LoyaltyMessage is the dedup guarantee: a duplicate insert throws P2002
 * and is treated as "already handled", so repeated cron ticks never double-send.
 */
export async function runLoyaltyForBusiness(business: {
  id: string;
  name: string;
}): Promise<LoyaltyRunResult> {
  const program = await prisma.loyaltyProgram.findUnique({
    where: { businessId: business.id },
  });

  if (!program || !program.isActive || !program.autoSendEnabled) {
    return { ...EMPTY, success: false, error: "מועדון הנאמנות אינו פעיל לשליחה אוטומטית." };
  }

  const visitsRequired = Math.max(2, program.visitsRequired);

  const clients = await prisma.client.findMany({
    where: {
      businessId: business.id,
      bookings: { some: { status: "completed" } },
      unsubscribedAt: null,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      _count: {
        select: {
          bookings: { where: { status: "completed", businessId: business.id } },
          loyaltyRedemptions: true,
        },
      },
    },
  });

  const candidates: Candidate[] = [];
  for (const c of clients) {
    const completedVisits = c._count.bookings;
    const hit = classifyLoyaltyMilestone(
      completedVisits,
      c._count.loyaltyRedemptions,
      visitsRequired,
    );
    if (!hit) continue;

    candidates.push({
      clientId: c.id,
      fullName: c.fullName,
      phone: c.phone,
      completedVisits,
      type: hit.type,
      milestone: hit.milestone,
    });
  }

  if (candidates.length === 0) return EMPTY;

  const provider = await getWhatsAppProviderForBusiness(business.id);
  const reward = program.rewardDescription;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const cand of candidates) {
    const template =
      cand.type === "reward_earned"
        ? program.rewardMessage || LOYALTY_DEFAULTS.rewardMessage
        : program.almostThereMessage || LOYALTY_DEFAULTS.almostThereMessage;

    const messageText = renderLoyaltyMessage(template, {
      clientName: cand.fullName,
      businessName: business.name,
      reward,
      completedVisits: cand.completedVisits,
    });

    // Atomic dedup: creating the row is the "claim". If another tick already
    // claimed this milestone, the unique index rejects it and we skip.
    let messageId: string;
    try {
      const created = await prisma.loyaltyMessage.create({
        data: {
          businessId: business.id,
          programId: program.id,
          clientId: cand.clientId,
          type: cand.type,
          milestone: cand.milestone,
          phone: toWaPhone(cand.phone),
          messageText,
          status: "queued",
        },
        select: { id: true },
      });
      messageId = created.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue; // already messaged for this milestone
      }
      throw err;
    }

    if (!isValidIsraeliPhone(cand.phone)) {
      await prisma.loyaltyMessage.update({
        where: { id: messageId },
        data: { status: "skipped", failureReason: "מספר טלפון לא תקין" },
      });
      skippedCount++;
      continue;
    }

    const templateVariables =
      program.templateName && program.templateName !== "hello_world"
        ? { "1": cand.fullName, "2": business.name }
        : undefined;

    const result = await provider.send({
      businessId: business.id,
      toPhone: toWaPhone(cand.phone),
      templateId: program.templateName ?? undefined,
      templateLanguage: program.templateLanguage ?? "he",
      templateVariables,
      fallbackText: messageText,
      // Loyalty runs aren't AutomationRuns; this synthetic id is a log label only.
      automationRunId: `loyalty:${messageId}`,
      clientId: cand.clientId,
    });

    if (result.isMockSkip) {
      await prisma.loyaltyMessage.update({
        where: { id: messageId },
        data: { status: "skipped", failureReason: DEV_MOCK_SKIP_REASON },
      });
      skippedCount++;
    } else if (result.isTestModeBlock) {
      await prisma.loyaltyMessage.update({
        where: { id: messageId },
        data: { status: "skipped", failureReason: TEST_MODE_BLOCKED_REASON },
      });
      skippedCount++;
    } else if (result.success) {
      await prisma.loyaltyMessage.update({
        where: { id: messageId },
        data: {
          status: "sent",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
        },
      });
      sentCount++;
    } else {
      await prisma.loyaltyMessage.update({
        where: { id: messageId },
        data: { status: "failed", failureReason: result.failureReason },
      });
      failedCount++;
    }
  }

  console.log(
    `[runLoyaltyForBusiness] done — businessId=${business.id} ` +
      `candidates=${candidates.length} sent=${sentCount} failed=${failedCount} skipped=${skippedCount}`,
  );

  return { success: true, sentCount, skippedCount, failedCount };
}
