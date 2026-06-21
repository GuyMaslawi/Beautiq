import { describe, it, expect } from "vitest";
import * as premium from "@/components/premium";

describe("premium barrel", () => {
  it("re-exports the key components and tokens", () => {
    const expected = [
      "PremiumPageShell",
      "BeautyPageHero",
      "EditorialSectionHeader",
      "PremiumMetricCard",
      "BeautyInsightCard",
      "ClientAuraCard",
      "AppointmentTimelineCard",
      "GrowthOpportunityCard",
      "PremiumEmptyState",
      "LuxuryStatusPill",
      "FloatingActionPanel",
      "PublicBookingHero",
      "ServiceShowcaseCard",
      "AuraBlob",
      "StatRibbon",
      "tone",
      "tintAccent",
      "tintAura",
      "tintGradient",
      "tintWash",
    ] as const;
    for (const name of expected) {
      expect(premium[name as keyof typeof premium]).toBeDefined();
    }
  });
});
