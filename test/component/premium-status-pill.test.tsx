// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LuxuryStatusPill } from "@/components/premium/status-pill";

const tones = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
  "info",
  "gold",
] as const;

describe("LuxuryStatusPill", () => {
  it.each(tones)("renders %s tone (soft)", (tone) => {
    render(<LuxuryStatusPill tone={tone}>{tone}</LuxuryStatusPill>);
    expect(screen.getByText(tone)).toBeInTheDocument();
  });

  it("renders the solid variant", () => {
    render(
      <LuxuryStatusPill tone="brand" variant="solid">
        מלא
      </LuxuryStatusPill>,
    );
    expect(screen.getByText("מלא").getAttribute("style")).toContain(
      "linear-gradient",
    );
  });

  it("renders the pulsing dot and an icon", () => {
    render(
      <LuxuryStatusPill tone="success" dot icon={<i data-testid="ic" />}>
        מחובר
      </LuxuryStatusPill>,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    expect(document.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("renders the solid dot variant", () => {
    render(
      <LuxuryStatusPill tone="brand" variant="solid" dot>
        חי
      </LuxuryStatusPill>,
    );
    expect(document.querySelector(".animate-ping")).toBeInTheDocument();
  });
});
