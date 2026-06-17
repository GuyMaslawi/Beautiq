/**
 * Pure builders for the Meta Embedded Signup FB.login launch payload.
 *
 * These are deliberately framework-free so they can be unit-tested without a DOM
 * and reused by the connection card. The payload carries NO secrets — config_id
 * and appId are public (NEXT_PUBLIC_*), and there is never a token here. The
 * "sanitized" payload below is what we log to the browser console and show in the
 * admin diagnostics box.
 *
 * TRACK → PAYLOAD: the owner's chosen connection track must change what we ask
 * Meta to do. The existing-business track requests Meta's existing WhatsApp
 * Business App onboarding (coexistence) via `featureType`; the new-number and
 * personal tracks use the standard Embedded Signup flow and deliberately do NOT
 * pass that featureType. Whether Meta actually offers coexistence still depends
 * on the Meta configuration + the account/number eligibility — passing the
 * featureType is necessary but not sufficient.
 */

import type { ConnectionTrack } from "@/lib/whatsapp/connection-tracks";

/** The Config ID production is expected to launch with (Facebook Login for Business). */
export const EXPECTED_META_CONFIG_ID = "1579233260602857";

/**
 * Meta Embedded Signup feature for onboarding an EXISTING WhatsApp Business App
 * number (coexistence). Passed in `extras.featureType` only for the
 * existing-business track.
 */
export const EXISTING_BUSINESS_FEATURE_TYPE = "whatsapp_business_app_onboarding";

/** Session info channel version we read FINISH/CANCEL events from. */
export const SESSION_INFO_VERSION = "3";

export interface EmbeddedSignupExtras {
  setup: Record<string, unknown>;
  featureType: string;
  sessionInfoVersion: string;
}

export interface FbLoginConfig {
  config_id?: string;
  response_type: "code";
  override_default_response_type: true;
  extras: EmbeddedSignupExtras;
}

/**
 * Build the track-specific `extras` object for FB.login.
 *
 * - existing_business_app → featureType = whatsapp_business_app_onboarding
 * - new_number / personal → featureType = "" (standard new-number flow)
 *
 * Personal numbers cannot be onboarded through the existing-business coexistence
 * feature, so they use the standard flow exactly like new numbers.
 */
export function buildEmbeddedSignupExtras(track: ConnectionTrack): EmbeddedSignupExtras {
  const base: EmbeddedSignupExtras = {
    setup: {},
    featureType: "",
    sessionInfoVersion: SESSION_INFO_VERSION,
  };
  if (track === "existing_business_app") {
    return { ...base, featureType: EXISTING_BUSINESS_FEATURE_TYPE };
  }
  return base;
}

/** Build the full FB.login config object for a given track. */
export function buildFbLoginConfig(
  configId: string | undefined,
  track: ConnectionTrack,
): FbLoginConfig {
  return {
    config_id: configId,
    response_type: "code",
    override_default_response_type: true,
    extras: buildEmbeddedSignupExtras(track),
  };
}

/** True when the configured Config ID is the expected production Config ID. */
export function configIdMatches(configId?: string | null): boolean {
  return configId === EXPECTED_META_CONFIG_ID;
}

/**
 * Mask a public App ID for display. The App ID is not a secret, but we mask it in
 * the UI to avoid casual shoulder-surfing copy. Short values are returned as-is.
 */
export function maskAppId(appId?: string | null): string {
  if (!appId) return "missing";
  if (appId.length <= 6) return appId;
  return `${appId.slice(0, 4)}…${appId.slice(-2)}`;
}

/**
 * The sanitized launch payload we log and surface to admins. Mirrors exactly what
 * we hand to FB.login (minus nothing — there are no secrets), plus the selected
 * track and the keys of the extras object for quick inspection.
 */
export interface SanitizedLaunchPayload {
  appId: string;
  config_id?: string;
  selectedConnectionTrack: ConnectionTrack;
  response_type: string;
  override_default_response_type: boolean;
  sessionInfoVersion: string;
  featureType: string;
  extrasKeys: string[];
  extras: EmbeddedSignupExtras;
}

/**
 * Build the sanitized, secret-free payload for logging + the admin debug box.
 * `appId` is masked; `config_id` is shown in full because the task explicitly
 * needs to confirm it equals the expected production Config ID.
 */
export function buildSanitizedLaunchPayload(args: {
  appId?: string;
  configId?: string;
  track: ConnectionTrack;
}): SanitizedLaunchPayload {
  const cfg = buildFbLoginConfig(args.configId, args.track);
  return {
    appId: maskAppId(args.appId),
    config_id: cfg.config_id,
    selectedConnectionTrack: args.track,
    response_type: cfg.response_type,
    override_default_response_type: cfg.override_default_response_type,
    sessionInfoVersion: cfg.extras.sessionInfoVersion,
    featureType: cfg.extras.featureType,
    extrasKeys: Object.keys(cfg.extras),
    extras: cfg.extras,
  };
}
