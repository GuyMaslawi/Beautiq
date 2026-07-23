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
  autoSendEnabled: boolean;
  almostThereMessage: string;
  rewardMessage: string;
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
  /** Every client with ≥1 completed visit, sorted by completed visits desc. */
  members: LoyaltyClientProgress[];
  totalRewardsGiven: number;
  totalMembers: number;
}

/** The default (unconfigured) program shape. */
function defaultConfig(): LoyaltyProgramConfig {
  return {
    isActive: true,
    visitsRequired: LOYALTY_DEFAULTS.visitsRequired,
    rewardDescription: "",
    autoSendEnabled: false,
    almostThereMessage: LOYALTY_DEFAULTS.almostThereMessage,
    rewardMessage: LOYALTY_DEFAULTS.rewardMessage,
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
    autoSendEnabled: program.autoSendEnabled,
    // Fall back to the friendly starter copy if the owner left a message blank.
    almostThereMessage: program.almostThereMessage || LOYALTY_DEFAULTS.almostThereMessage,
    rewardMessage: program.rewardMessage || LOYALTY_DEFAULTS.rewardMessage,
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
          bookings: { where: { status: "completed", businessId: tenant.businessId } },
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

  const members = [...progresses].sort(
    (a, b) =>
      b.pendingRewards - a.pendingRewards ||
      b.visitsInCurrentCard - a.visitsInCurrentCard ||
      b.completedVisits - a.completedVisits,
  );

  return {
    config,
    eligibleClients,
    closeClients,
    members,
    totalRewardsGiven,
    totalMembers: progresses.length,
  };
}

/**
 * Loyalty progress for a SINGLE client — used on the client profile card. Returns
 * null when the program isn't configured or the client has no completed visits.
 */
export interface ClientLoyaltyStatus {
  isActive: boolean;
  visitsRequired: number;
  rewardDescription: string;
  completedVisits: number;
  visitsInCurrentCard: number;
  pendingRewards: number;
  redeemedRewards: number;
  /** Visits left to the next reward (0 when a reward is already pending). */
  visitsToReward: number;
}

export async function getClientLoyaltyStatus(
  tenant: TenantContext,
  clientId: string,
): Promise<ClientLoyaltyStatus | null> {
  const [config, client] = await Promise.all([
    getLoyaltyProgram(tenant),
    prisma.client.findFirst({
      where: { id: clientId, businessId: tenant.businessId },
      select: {
        id: true,
        _count: {
          select: {
            bookings: { where: { status: "completed", businessId: tenant.businessId } },
            loyaltyRedemptions: true,
          },
        },
      },
    }),
  ]);

  if (!config.configured || !client) return null;
  const completedVisits = client._count.bookings;
  if (completedVisits === 0) return null;

  const visitsRequired = Math.max(1, config.visitsRequired);
  const redeemedRewards = client._count.loyaltyRedemptions;
  const earnedRewards = Math.floor(completedVisits / visitsRequired);
  const pendingRewards = Math.max(0, earnedRewards - redeemedRewards);
  const visitsInCurrentCard = completedVisits % visitsRequired;
  const visitsToReward = pendingRewards > 0 ? 0 : visitsRequired - visitsInCurrentCard;

  return {
    isActive: config.isActive,
    visitsRequired,
    rewardDescription: config.rewardDescription,
    completedVisits,
    visitsInCurrentCard,
    pendingRewards,
    redeemedRewards,
    visitsToReward,
  };
}

/** Compact loyalty progress for a batch of clients — used by the clients list. */
export interface ClientLoyaltyBadge {
  visitsRequired: number;
  visitsInCurrentCard: number;
  pendingRewards: number;
}

export async function getClientsLoyaltyBadges(
  tenant: TenantContext,
  clientIds: string[],
): Promise<Map<string, ClientLoyaltyBadge>> {
  const map = new Map<string, ClientLoyaltyBadge>();
  if (clientIds.length === 0) return map;

  const config = await getLoyaltyProgram(tenant);
  if (!config.configured || !config.isActive) return map;
  const visitsRequired = Math.max(1, config.visitsRequired);

  const clients = await prisma.client.findMany({
    where: {
      businessId: tenant.businessId,
      id: { in: clientIds },
      bookings: { some: { status: "completed" } },
    },
    select: {
      id: true,
      _count: {
        select: {
          bookings: { where: { status: "completed", businessId: tenant.businessId } },
          loyaltyRedemptions: true,
        },
      },
    },
  });

  for (const c of clients) {
    const completedVisits = c._count.bookings;
    if (completedVisits === 0) continue;
    const earnedRewards = Math.floor(completedVisits / visitsRequired);
    const pendingRewards = Math.max(0, earnedRewards - c._count.loyaltyRedemptions);
    map.set(c.id, {
      visitsRequired,
      visitsInCurrentCard: completedVisits % visitsRequired,
      pendingRewards,
    });
  }
  return map;
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
