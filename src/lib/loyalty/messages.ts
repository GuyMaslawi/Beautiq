/**
 * Loyalty auto-message rendering. Client-safe (no Prisma import) so the config
 * form preview and the server runner share the exact same output.
 *
 * Variables (Hebrew, owner-facing): {שם} {שם העסק} {הטבה} {מספר ביקורים}
 */

export interface LoyaltyMessageVars {
  clientName: string;
  businessName: string;
  reward: string;
  completedVisits: number;
}

/** Replace the Hebrew {variables} in an owner-defined template. */
export function renderLoyaltyMessage(
  template: string,
  vars: LoyaltyMessageVars,
): string {
  return template
    .replaceAll("{שם}", vars.clientName)
    .replaceAll("{שם העסק}", vars.businessName)
    .replaceAll("{הטבה}", vars.reward || "הטבה")
    .replaceAll("{מספר ביקורים}", String(vars.completedVisits));
}
