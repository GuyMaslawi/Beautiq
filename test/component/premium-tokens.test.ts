import { describe, it, expect } from "vitest";
import {
  tone,
  tintAccent,
  tintAura,
  tintGradient,
  tintWash,
} from "@/components/premium/tokens";

const tints = ["blush", "rose", "mauve", "plum", "champagne", "sage"] as const;
const tones = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "info",
  "gold",
] as const;

describe("premium tokens", () => {
  it("exposes every tint family across all tint maps", () => {
    for (const t of tints) {
      expect(tintAura[t]).toBeTruthy();
      expect(tintGradient[t]).toBeTruthy();
      expect(tintAccent[t]).toBeTruthy();
      expect(tintWash[t]).toBeTruthy();
    }
  });

  it("exposes every tone with fg/bg/border/glow", () => {
    for (const k of tones) {
      expect(tone[k]).toMatchObject({
        fg: expect.any(String),
        bg: expect.any(String),
        border: expect.any(String),
        glow: expect.any(String),
      });
    }
  });
});
