// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";

const tones = ["neutral", "success", "warning", "danger", "info"] as const;

describe("StatusBadge", () => {
  it.each(tones)("renders %s tone", (tone) => {
    render(<StatusBadge tone={tone}>{tone}</StatusBadge>);
    expect(screen.getByText(tone)).toBeInTheDocument();
  });

  it("defaults to neutral tone", () => {
    render(<StatusBadge>ברירת מחדל</StatusBadge>);
    expect(screen.getByText("ברירת מחדל")).toBeInTheDocument();
  });

  it("merges className and custom style", () => {
    render(
      <StatusBadge tone="success" className="extra" style={{ opacity: 0.5 }}>
        x
      </StatusBadge>,
    );
    const el = screen.getByText("x");
    expect(el).toHaveClass("extra");
    expect(el.getAttribute("style")).toContain("opacity");
  });
});
