/**
 * Loyalty program defaults and bounds. Client-safe (no Prisma import) so both
 * the server layer and form validation can share them.
 */
export const LOYALTY_DEFAULTS = {
  visitsRequired: 10,
  /** A friendly starter reward the owner can keep or edit. */
  rewardDescription: "טיפול במתנה 💝",
  /** Starter auto-message sent one visit before the reward. */
  almostThereMessage:
    "היי {שם}! 🌟 עוד ביקור אחד ואת מקבלת {הטבה}. נשמח לראות אותך בקרוב ❤️",
  /** Starter auto-message sent when the reward is earned. */
  rewardMessage:
    "היי {שם}! 🎉 השלמת את כרטיסיית הנאמנות אצל {שם העסק} — מגיעה לך {הטבה}. נשמח לראות אותך שוב ❤️",
} as const;

export const LOYALTY_BOUNDS = {
  minVisits: 2,
  maxVisits: 50,
  maxRewardLength: 120,
  maxMessageLength: 500,
} as const;

/** Variables the owner may use inside the auto-message templates. */
export const LOYALTY_MESSAGE_VARIABLES = [
  "{שם}",
  "{שם העסק}",
  "{הטבה}",
  "{מספר ביקורים}",
] as const;
