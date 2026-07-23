import { describe, it, expect } from "vitest";
import { classifyLoyaltyMilestone } from "@/server/loyalty/runner";
import { renderLoyaltyMessage } from "@/lib/loyalty/messages";

describe("classifyLoyaltyMilestone", () => {
  const REQ = 10;

  it("flags a client one visit short of the reward (9/10)", () => {
    expect(classifyLoyaltyMilestone(9, 0, REQ)).toEqual({
      type: "almost_there",
      milestone: 0,
    });
  });

  it("flags a client who just completed the card (10/10) as reward earned", () => {
    expect(classifyLoyaltyMilestone(10, 0, REQ)).toEqual({
      type: "reward_earned",
      milestone: 1,
    });
  });

  it("does NOT re-flag reward_earned once that reward was redeemed", () => {
    expect(classifyLoyaltyMilestone(10, 1, REQ)).toBeNull();
  });

  it("flags the almost_there of the SECOND card (19/10)", () => {
    expect(classifyLoyaltyMilestone(19, 1, REQ)).toEqual({
      type: "almost_there",
      milestone: 1,
    });
  });

  it("flags the SECOND reward earned (20/10) with milestone 2", () => {
    expect(classifyLoyaltyMilestone(20, 1, REQ)).toEqual({
      type: "reward_earned",
      milestone: 2,
    });
  });

  it("returns null mid-card (5/10) — no back-fill of old milestones", () => {
    expect(classifyLoyaltyMilestone(5, 0, REQ)).toBeNull();
  });

  it("returns null for clients with no completed visits", () => {
    expect(classifyLoyaltyMilestone(0, 0, REQ)).toBeNull();
  });

  it("handles a small card size (2 visits) — 1/2 is almost, 2/2 is earned", () => {
    expect(classifyLoyaltyMilestone(1, 0, 2)).toEqual({
      type: "almost_there",
      milestone: 0,
    });
    expect(classifyLoyaltyMilestone(2, 0, 2)).toEqual({
      type: "reward_earned",
      milestone: 1,
    });
  });

  it("guards against invalid card sizes (<2)", () => {
    expect(classifyLoyaltyMilestone(5, 0, 1)).toBeNull();
  });
});

describe("renderLoyaltyMessage", () => {
  const vars = {
    clientName: "מיכל",
    businessName: "הסטודיו של יעל",
    reward: "טיפול במתנה",
    completedVisits: 9,
  };

  it("substitutes every supported Hebrew variable", () => {
    const out = renderLoyaltyMessage(
      "היי {שם}! עוד ביקור ואת מקבלת {הטבה} ב{שם העסק} (ביקור {מספר ביקורים})",
      vars,
    );
    expect(out).toBe(
      "היי מיכל! עוד ביקור ואת מקבלת טיפול במתנה בהסטודיו של יעל (ביקור 9)",
    );
  });

  it("replaces ALL occurrences of a variable", () => {
    expect(renderLoyaltyMessage("{שם} {שם}", vars)).toBe("מיכל מיכל");
  });

  it("falls back to a neutral word when the reward is empty", () => {
    expect(renderLoyaltyMessage("{הטבה}", { ...vars, reward: "" })).toBe("הטבה");
  });
});
