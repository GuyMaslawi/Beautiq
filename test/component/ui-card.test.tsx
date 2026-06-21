// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/card";

const variants = ["default", "tinted", "flat", "glass"] as const;

describe("Card", () => {
  it.each(variants)("renders %s variant", (variant) => {
    render(
      <Card variant={variant} data-testid={`card-${variant}`}>
        תוכן
      </Card>,
    );
    expect(screen.getByTestId(`card-${variant}`)).toHaveTextContent("תוכן");
  });

  it("defaults to the default variant with shadow style", () => {
    render(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId("card").getAttribute("style")).toContain(
      "box-shadow",
    );
  });

  it("glass variant uses glass-card class and no inline style", () => {
    render(<Card variant="glass" data-testid="glass">g</Card>);
    expect(screen.getByTestId("glass")).toHaveClass("glass-card");
  });

  it("merges className and custom style", () => {
    render(
      <Card className="extra" style={{ opacity: 0.5 }} data-testid="merged">
        m
      </Card>,
    );
    const el = screen.getByTestId("merged");
    expect(el).toHaveClass("extra");
    expect(el.getAttribute("style")).toContain("opacity");
  });
});
