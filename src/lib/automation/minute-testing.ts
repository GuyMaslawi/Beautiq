/**
 * Minute-based "test timing" mode for automations.
 *
 * Production automation timing is always day-based (see CLAUDE.md §14–15).
 * Waiting real days is too slow when validating Meta/WhatsApp/automation flows,
 * so we allow timing to be expressed in MINUTES — but only for testing, and only
 * in safe contexts. Minute mode never bypasses any send guard, opt-in, marketing
 * opt-in, unsubscribed, upcoming-booking, cooldown, or provider/env check; it only
 * shrinks the inactivity/cooldown windows so eligibility can be reached quickly.
 *
 * This module is the single source of truth for WHO may use minute mode and how a
 * stored setting resolves to an effective unit. Both the UI (server-computed prop)
 * and the backend (runner + actions) consult it, so the two can never diverge.
 */

export type TimingUnit = "days" | "minutes";

/** Env flag that explicitly opts a production deployment into minute testing. */
export const MINUTE_TESTING_ENV_FLAG = "ENABLE_AUTOMATION_MINUTE_TESTING";

/**
 * Whether minute-based timing may be used in the current environment/context.
 *
 * Allowed when ANY of:
 *   - we are NOT in production (dev/test/staging) — testing is the whole point
 *   - the caller is an admin (controlled testing in production)
 *   - ENABLE_AUTOMATION_MINUTE_TESTING=true (explicit opt-in for owners/cron)
 *
 * A regular business owner in production sees/uses it ONLY when the env flag is on.
 * Cron has no user, so it passes no context: in production it relies on the env flag.
 */
export function isMinuteTestingAllowed(ctx?: { isAdmin?: boolean }): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (ctx?.isAdmin === true) return true;
  if (process.env[MINUTE_TESTING_ENV_FLAG] === "true") return true;
  return false;
}

/**
 * Resolve the effective timing unit for a run.
 * A stored "minutes" unit is honored only when minute testing is allowed here;
 * otherwise it safely falls back to "days" so production never sends on minutes
 * by accident.
 */
export function resolveTimingUnit(
  storedUnit: string | null | undefined,
  allowMinutes: boolean,
): TimingUnit {
  return allowMinutes && storedUnit === "minutes" ? "minutes" : "days";
}
