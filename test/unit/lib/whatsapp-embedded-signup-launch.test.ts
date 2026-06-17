import { describe, it, expect } from "vitest";
import {
  buildEmbeddedSignupExtras,
  buildFbLoginConfig,
  buildSanitizedLaunchPayload,
  configIdMatches,
  maskAppId,
  EXPECTED_META_CONFIG_ID,
  EXISTING_BUSINESS_FEATURE_TYPE,
  SESSION_INFO_VERSION,
} from "@/lib/whatsapp/embedded-signup-launch";

describe("buildEmbeddedSignupExtras — track-specific featureType", () => {
  it("existing_business_app requests existing WhatsApp Business App onboarding (coexistence)", () => {
    const extras = buildEmbeddedSignupExtras("existing_business_app");
    expect(extras.featureType).toBe(EXISTING_BUSINESS_FEATURE_TYPE);
    expect(extras.featureType).toBe("whatsapp_business_app_onboarding");
    expect(extras.sessionInfoVersion).toBe(SESSION_INFO_VERSION);
    expect(extras.setup).toEqual({});
  });

  it("new_number uses the standard flow and does NOT pass the existing-business featureType", () => {
    const extras = buildEmbeddedSignupExtras("new_number");
    expect(extras.featureType).toBe("");
    expect(extras.featureType).not.toBe(EXISTING_BUSINESS_FEATURE_TYPE);
  });

  it("personal uses the standard flow (no coexistence featureType)", () => {
    const extras = buildEmbeddedSignupExtras("personal");
    expect(extras.featureType).toBe("");
  });
});

describe("buildFbLoginConfig — existing_business vs new_number differ", () => {
  it("existing_business and new_number produce DIFFERENT payloads", () => {
    const existing = buildFbLoginConfig("cfg", "existing_business_app");
    const fresh = buildFbLoginConfig("cfg", "new_number");
    expect(existing).not.toEqual(fresh);
    expect(existing.extras.featureType).toBe("whatsapp_business_app_onboarding");
    expect(fresh.extras.featureType).toBe("");
  });

  it("carries the standard supported Embedded Signup fields", () => {
    const cfg = buildFbLoginConfig("cfg_123", "new_number");
    expect(cfg.config_id).toBe("cfg_123");
    expect(cfg.response_type).toBe("code");
    expect(cfg.override_default_response_type).toBe(true);
    expect(cfg.extras.sessionInfoVersion).toBe("3");
  });
});

describe("configIdMatches — production Config ID check", () => {
  it("matches the expected production Config ID", () => {
    expect(EXPECTED_META_CONFIG_ID).toBe("1579233260602857");
    expect(configIdMatches("1579233260602857")).toBe(true);
  });

  it("rejects any other / missing Config ID", () => {
    expect(configIdMatches("999")).toBe(false);
    expect(configIdMatches(undefined)).toBe(false);
    expect(configIdMatches(null)).toBe(false);
    expect(configIdMatches("")).toBe(false);
  });
});

describe("maskAppId", () => {
  it("masks a long App ID, keeping head and tail", () => {
    const masked = maskAppId("1234567890123456");
    expect(masked).toBe("1234…56");
    expect(masked).not.toContain("7890");
  });

  it("returns a friendly placeholder when missing", () => {
    expect(maskAppId(undefined)).toBe("missing");
    expect(maskAppId(null)).toBe("missing");
  });
});

describe("buildSanitizedLaunchPayload — secret-free, mirrors FB.login", () => {
  it("includes track, exact config_id, masked appId, and extras keys", () => {
    const p = buildSanitizedLaunchPayload({
      appId: "1234567890123456",
      configId: "1579233260602857",
      track: "existing_business_app",
    });
    expect(p.selectedConnectionTrack).toBe("existing_business_app");
    expect(p.config_id).toBe("1579233260602857"); // exact, public
    expect(p.appId).toBe("1234…56"); // masked
    expect(p.featureType).toBe("whatsapp_business_app_onboarding");
    expect(p.response_type).toBe("code");
    expect(p.override_default_response_type).toBe(true);
    expect(p.sessionInfoVersion).toBe("3");
    expect(p.extrasKeys.sort()).toEqual(["featureType", "sessionInfoVersion", "setup"]);
  });

  it("never contains tokens/secrets — serialized payload is safe to log", () => {
    const p = buildSanitizedLaunchPayload({
      appId: "1234567890123456",
      configId: "cfg",
      track: "new_number",
    });
    const json = JSON.stringify(p).toLowerCase();
    expect(json).not.toContain("token");
    expect(json).not.toContain("secret");
    expect(json).not.toContain("access");
    // The full unmasked App ID must not leak through the sanitized payload.
    expect(json).not.toContain("1234567890123456");
  });
});
