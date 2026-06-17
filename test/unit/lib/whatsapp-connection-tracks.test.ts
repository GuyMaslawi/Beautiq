import { describe, it, expect } from "vitest";
import {
  CONNECTION_TRACKS,
  getTrackInfo,
  connectionSourceLabel,
  looksLikeMetaTestNumber,
  classifyMetaConnectError,
} from "@/lib/whatsapp/connection-tracks";

describe("connection tracks metadata", () => {
  it("exposes exactly the three onboarding tracks with Hebrew copy", () => {
    expect(CONNECTION_TRACKS.map((t) => t.track)).toEqual([
      "existing_business_app",
      "personal",
      "new_number",
    ]);
    // The existing-business track is recommended; personal carries a warning + ack.
    expect(getTrackInfo("existing_business_app").recommendedBadge).toBe("מומלץ לרוב העסקים");
    expect(getTrackInfo("personal").warning).toBeTruthy();
    expect(getTrackInfo("personal").ackWarning).toBeTruthy();
    expect(getTrackInfo("new_number").warning).toBeUndefined();
  });

  it("labels stored connection sources in Hebrew", () => {
    expect(connectionSourceLabel("existing_business_app")).toContain("WhatsApp Business");
    expect(connectionSourceLabel("personal")).toBe("מספר אישי");
    expect(connectionSourceLabel("new_number")).toBe("מספר חדש");
    expect(connectionSourceLabel(undefined)).toBe("לא ידוע");
    expect(connectionSourceLabel("unknown")).toBe("לא ידוע");
  });
});

describe("looksLikeMetaTestNumber", () => {
  it("flags Meta +1 555 test numbers", () => {
    expect(looksLikeMetaTestNumber("+1 555-123-4567")).toBe(true);
    expect(looksLikeMetaTestNumber("+15550000000")).toBe(true);
  });

  it("does not flag a real Israeli business number", () => {
    expect(looksLikeMetaTestNumber("+972 50-123-4567")).toBe(false);
    expect(looksLikeMetaTestNumber("+972501234567")).toBe(false);
    expect(looksLikeMetaTestNumber(undefined)).toBe(false);
    expect(looksLikeMetaTestNumber(null)).toBe(false);
  });
});

describe("classifyMetaConnectError", () => {
  it("maps already-registered / migrate / in-use errors", () => {
    expect(classifyMetaConnectError("This phone number is already registered")).toBe("already_registered");
    expect(classifyMetaConnectError("Please disconnect from the existing account")).toBe("already_registered");
    expect(classifyMetaConnectError("You must migrate this phone number")).toBe("already_registered");
    expect(classifyMetaConnectError("error 133016")).toBe("already_registered");
  });

  it("falls back to generic for unknown / empty messages", () => {
    expect(classifyMetaConnectError("Something else went wrong")).toBe("generic");
    expect(classifyMetaConnectError("")).toBe("generic");
    expect(classifyMetaConnectError(null)).toBe("generic");
  });
});
