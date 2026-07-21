/**
 * Loyalty program defaults and bounds. Client-safe (no Prisma import) so both
 * the server layer and form validation can share them.
 */
export const LOYALTY_DEFAULTS = {
  visitsRequired: 10,
  /** A friendly starter reward the owner can keep or edit. */
  rewardDescription: "טיפול במתנה 💝",
} as const;

export const LOYALTY_BOUNDS = {
  minVisits: 2,
  maxVisits: 50,
  maxRewardLength: 120,
} as const;
