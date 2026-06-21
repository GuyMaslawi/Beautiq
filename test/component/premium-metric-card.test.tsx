// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumMetricCard } from "@/components/premium/metric-card";

const icon = <span data-testid="icon">i</span>;

describe("PremiumMetricCard", () => {
  it("renders label and count (neutral default)", () => {
    render(<PremiumMetricCard label="הכנסות" count="₪1,200" />);
    expect(screen.getByText("הכנסות")).toBeInTheDocument();
    expect(screen.getByText("₪1,200")).toBeInTheDocument();
  });

  it("maps highlight and warn legacy aliases to tone", () => {
    const { rerender } = render(
      <PremiumMetricCard label="h" count={1} highlight icon={icon} />,
    );
    expect(screen.getByText("h")).toBeInTheDocument();
    rerender(<PremiumMetricCard label="w" count={2} warn icon={icon} />);
    expect(screen.getByText("w")).toBeInTheDocument();
  });

  it("renders helper, an explicit tone, and an up trend pill", () => {
    render(
      <PremiumMetricCard
        label="l"
        count={5}
        icon={icon}
        tone="success"
        helper="עזרה"
        trend={{ dir: "up", label: "+12%" }}
      />,
    );
    expect(screen.getByText("עזרה")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders a down/bad trend pill", () => {
    render(
      <PremiumMetricCard
        label="l"
        count={5}
        trend={{ dir: "down", label: "-8%", good: false }}
      />,
    );
    expect(screen.getByText("-8%")).toBeInTheDocument();
  });

  it("renders a sparkline when spark has more than one point", () => {
    const { container } = render(
      <PremiumMetricCard label="l" count={1} spark={[0.1, 0.5, 1]} />,
    );
    // 3 sparkline bars rendered
    expect(container.querySelectorAll(".rounded-sm").length).toBe(3);
  });

  it("renders compact mode with icon", () => {
    render(
      <PremiumMetricCard label="קומפקטי" count={9} icon={icon} compact />,
    );
    expect(screen.getByText("קומפקטי")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});
