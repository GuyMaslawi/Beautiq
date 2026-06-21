// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatRibbon } from "@/components/premium/stat-ribbon";

describe("StatRibbon", () => {
  it("renders each stat value and label, covering every tone branch", () => {
    render(
      <StatRibbon
        stats={[
          { label: "ברירת מחדל", value: 1 },
          { label: "מותג", value: 2, tone: "brand", icon: <i data-testid="i" /> },
          { label: "הצלחה", value: 3, tone: "success" },
          { label: "אזהרה", value: 4, tone: "warning" },
        ]}
      />,
    );
    ["ברירת מחדל", "מותג", "הצלחה", "אזהרה"].forEach((l) =>
      expect(screen.getByText(l)).toBeInTheDocument(),
    );
    [1, 2, 3, 4].forEach((v) =>
      expect(screen.getByText(String(v))).toBeInTheDocument(),
    );
    expect(screen.getByTestId("i")).toBeInTheDocument();
  });

  it("merges a custom className", () => {
    const { container } = render(
      <StatRibbon className="x" stats={[{ label: "l", value: 1 }]} />,
    );
    expect(container.firstElementChild).toHaveClass("x");
  });
});
