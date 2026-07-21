import { prisma } from "@/server/db/prisma";
import type { TenantContext } from "@/server/db/tenant";
import { LOYALTY_DEFAULTS } from "@/lib/loyalty/constants";

/**
 * Visit-based loyalty ("punch card").
 *
 * A client's progress is derived, never denormalized: it is the number of
 * COMPLETED bookings minus the visits already consumed by past redemptions.
 * This keeps the math correct even if bookings are edited after the fact and
 * avoids a counter that can drift out of sync (see CLAUDE.md §11).
 *
 *   earnedRewards  = floor(completedVisits / visitsRequired)
 *   pendingRewards = earnedRewards - redemptionsCount
 *   progressInCard = completedVisits - redemptionsCount * visitsRequired  (clamped)
 */

export interface LoyaltyProgramConfig {
  isActive: boolean;
  visitsRequired: number;
  rewardDescription: string;
  /** True once a program row exists (owner has configured it at least once). */
  configured: boolean;
}

export interface LoyaltyClientProgress {
  clientId: string;
  fullName: string;
  phone: string;
  completedVisits: number;
  /** Visits accumulated toward the current (unearned) card, 0..visitsRequired-1. */
  visitsInCurrentCard: number;
  /** Rewards earned but not yet marked as given. */
  pendingRewards: number;
  /** Rewards already given to this client over its lifetime. */
  redeemedRewards: number;
}

export interface LoyaltyOverview {
  config: LoyaltyProgramConfig;
  eligibleClients: LoyaltyClientProgress[];
  closeClients: LoyaltyClientProgress[];
  totalRewardsGiven: number;
  totalMembers: number;
}

/** The default (unconfigured) program shape. */
function defaultConfig(): LoyaltyProgramConfig {
  return {
    isActive: true,
    visitsRequired: LOYALTY_DEFAULTS.visitsRequired,
    rewardDescription: "",
    configured: false,
  };
}

export async function getLoyaltyProgram(
  tenant: TenantContext,
): Promise<LoyaltyProgramConfig> {
  const program = await prisma.loyaltyProgram.findUnique({
    where: { businessId: tenant.businessId },
  });
  if (!program) return defaultConfig();
  return {
    isActive: program.isActive,
    visitsRequired: program.visitsRequired,
    rewardDescription: program.rewardDescription,
    configured: true,
  };
}

/**
 * Full loyalty overview for the owner-facing page: the config, the clients who
 * have earned a reward (eligible), and the clients who are close (within 2
 * visits of the next reward). Only clients with ≥1 completed visit are counted.
 */
export async function getLoyaltyOverview(
  tenant: TenantContext,
): Promise<LoyaltyOverview> {
  const config = await getLoyaltyProgram(tenant);
  const visitsRequired = Math.max(1, config.visitsRequired);

  // Clients with their completed-booking count and redemption count. We only
  // need clients who have at least one completed booking.
  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      bookings: { some: { status: "completed" } },
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      _count: {
        select: {
          bookings: { where: { status: "completed" } },
          loyaltyRedemptions: true,
        },
      },
    },
  });

  let totalRewardsGiven = 0;
  const progresses: LoyaltyClientProgress[] = clients.map((c) => {
    const completedVisits = c._count.bookings;
    const redeemedRewards = c._count.loyaltyRedemptions;
    totalRewardsGiven += redeemedRewards;
    const earnedRewards = Math.floor(completedVisits / visitsRequired);
    const pendingRewards = Math.max(0, earnedRewards - redeemedRewards);
    // Visits toward the next (not-yet-earned) card. Earned rewards consume whole
    // cards, so the remainder is what's left over.
    const visitsInCurrentCard = completedVisits % visitsRequired;
    return {
      clientId: c.id,
      fullName: c.fullName,
      phone: c.phone,
      completedVisits,
      visitsInCurrentCard,
      pendingRewards,
      redeemedRewards,
    };
  });

  const eligibleClients = progresses
    .filter((p) => p.pendingRewards > 0)
    .sort((a, b) => b.pendingRewards - a.pendingRewards || b.completedVisits - a.completedVisits);

  const closeClients = progresses
    .filter(
      (p) =>
        p.pendingRewards === 0 &&
        visitsRequired - p.visitsInCurrentCard <= 2 &&
        p.visitsInCurrentCard > 0,
    )
    .sort((a, b) => b.visitsInCurrentCard - a.visitsInCurrentCard)
    .slice(0, 12);

  return {
    config,
    eligibleClients,
    closeClients,
    totalRewardsGiven,
    totalMembers: progresses.length,
  };
}

/** Count of clients who currently have an unredeemed earned reward. */
export async function getLoyaltyEligibleCount(
  tenant: TenantContext,
): Promise<number> {
  const config = await getLoyaltyProgram(tenant);
  if (!config.configured || !config.isActive) return 0;
  const overview = await getLoyaltyOverview(tenant);
  return overview.eligibleClients.length;
}
