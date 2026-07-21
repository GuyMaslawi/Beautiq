import { describe, it, expect } from "vitest";
import {
  detectIntent,
  answerText,
  answerIntent,
  buildBriefing,
  SUGGESTED_QUESTIONS,
  type AssistantContext,
  type AssistantIntent,
} from "@/lib/assistant/engine";

/** A fully-populated context so every answer branch has data to render. */
function ctx(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    businessName: "הסטודיו של יעל",
    monthRevenue: 4200,
    expectedRevenue: 6100,
    monthlyTarget: 7000,
    gapToTarget: 900,
    isOnTrack: false,
    targetReliable: true,
    avgBookingValue: 210,
    lostRevenue: 300,
    completedBookingsCount: 20,
    topServices: [
      { name: "לק ג'ל", revenue: 2000, bookingsCount: 10, avgPrice: 200 },
      { name: "מניקור", revenue: 1200, bookingsCount: 8, avgPrice: 150 },
    ],
    activeServices: 5,
    totalClients: 42,
    atRiskCount: 3,
    atRiskTop: [
      { fullName: "דנה", daysSinceLastVisit: 40 },
      { fullName: "מיכל", daysSinceLastVisit: 55 },
    ],
    bookingsToday: 4,
    upcomingBookingsCount: 12,
    emptySlotsCount: 6,
    pricingConcernCount: 2,
    loyaltyConfigured: true,
    loyaltyEligibleCount: 2,
    guidance: [
      { id: "g1", title: "שלחי הודעה ללקוחות בסיכון", actionLabel: "החזרת לקוחות", href: "/bring-back" },
    ],
    ...overrides,
  };
}

describe("assistant engine — intent detection", () => {
  const cases: [string, AssistantIntent][] = [
    ["כמה הכנסתי החודש?", "revenue"],
    ["מה המחזור שלי?", "revenue"],
    ["מי הלקוחות שבסיכון לנטוש?", "atRisk"],
    ["מי לא חזרה מזמן?", "atRisk"],
    ["איפה יש לי חלונות פנויים?", "emptySlots"],
    ["כמה תורים יש לי היום?", "schedule"],
    ["מה יש לי מחר ביומן?", "schedule"],
    ["כמה פגישות קבועות לי?", "schedule"],
    ["האם המחירים שלי בסדר?", "pricing"],
    ["מי זכאית להטבת נאמנות?", "loyalty"],
    ["כמה לקוחות יש לי?", "clients"],
    ["מה השירותים הכי רווחיים שלי?", "topServices"],
    ["מה כדאי לי לעשות היום?", "today"],
  ];

  it.each(cases)("routes %s → %s", (question, expected) => {
    expect(detectIntent(question)).toBe(expected);
  });

  it("returns null for an unrelated question", () => {
    expect(detectIntent("מה מזג האוויר?")).toBeNull();
  });

  it("falls back gracefully on unknown free-text", () => {
    const a = answerText(ctx(), "בלה בלה בלה");
    expect(a.intent).toBe("fallback");
    expect(a.lines.length).toBeGreaterThan(0);
  });
});

describe("assistant engine — every intent produces a non-empty answer", () => {
  const intents: AssistantIntent[] = [
    "revenue",
    "atRisk",
    "emptySlots",
    "today",
    "pricing",
    "loyalty",
    "clients",
    "topServices",
    "schedule",
  ];

  it.each(intents)("answerIntent(%s) has a title and lines", (intent) => {
    const a = answerIntent(ctx(), intent);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.lines.length).toBeGreaterThan(0);
    expect(a.intent).toBe(intent);
  });

  it("every suggested chip maps to a builder", () => {
    for (const q of SUGGESTED_QUESTIONS) {
      expect(() => answerIntent(ctx(), q.intent)).not.toThrow();
    }
  });
});

describe("assistant engine — answers reflect the data (learns from context)", () => {
  it("clients answer reports the exact count from context", () => {
    const a = answerIntent(ctx({ totalClients: 99 }), "clients");
    expect(a.lines[0]).toContain("99");
  });

  it("revenue answer reflects a changed month revenue", () => {
    const a = answerIntent(ctx({ monthRevenue: 12345, completedBookingsCount: 30 }), "revenue");
    expect(a.lines.join(" ")).toContain("12,345");
  });

  it("schedule answer reflects today's bookings", () => {
    expect(answerIntent(ctx({ bookingsToday: 7 }), "schedule").lines[0]).toContain("7");
    expect(answerIntent(ctx({ bookingsToday: 0 }), "schedule").lines[0]).toContain("אין");
  });

  it("empty state answers stay friendly, not broken", () => {
    const empty = ctx({
      monthRevenue: 0,
      completedBookingsCount: 0,
      atRiskCount: 0,
      atRiskTop: [],
      emptySlotsCount: 0,
      topServices: [],
      pricingConcernCount: 0,
      loyaltyEligibleCount: 0,
    });
    for (const intent of ["revenue", "atRisk", "emptySlots", "topServices", "pricing"] as AssistantIntent[]) {
      expect(answerIntent(empty, intent).lines.length).toBeGreaterThan(0);
    }
  });
});

describe("assistant engine — daily briefing", () => {
  it("is empty when there is no data yet", () => {
    const blank = ctx({ totalClients: 0, completedBookingsCount: 0, bookingsToday: 0, monthRevenue: 0 });
    expect(buildBriefing(blank)).toEqual([]);
  });

  it("summarizes revenue, schedule and risks when data exists", () => {
    const lines = buildBriefing(ctx());
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(" ")).toContain("החודש הכנסת");
  });
});
