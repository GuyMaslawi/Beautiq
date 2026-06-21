// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/ui/metric-card";

const icon = <span data-testid="icon">i</span>;

describe("MetricCard", () => {
  it("renders label and count in full mode (neutral)", () => {
    render(<MetricCard label="תורים היום" count={5} icon={icon} />);
    expect(screen.getByText("תורים היום")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders helper line when provided", () => {
    render(
      <MetricCard label="l" count={1} icon={icon} helper="לעומת אתמול" />,
    );
    expect(screen.getByText("לעומת אתמול")).toBeInTheDocument();
  });

  it("renders highlight variant", () => {
    render(<MetricCard label="הדגשה" count={2} icon={icon} highlight />);
    expect(screen.getByText("הדגשה")).toBeInTheDocument();
  });

  it("renders warn variant", () => {
    render(<MetricCard label="אזהרה" count={3} icon={icon} warn />);
    expect(screen.getByText("אזהרה")).toBeInTheDocument();
  });

  it("renders compact mode (neutral)", () => {
    render(<MetricCard label="קומפקטי" count={4} icon={icon} compact />);
    expect(screen.getByText("קומפקטי")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders compact highlight and compact warn branches", () => {
    const { rerender } = render(
      <MetricCard label="ch" count={1} icon={icon} compact highlight />,
    );
    expect(screen.getByText("ch")).toBeInTheDocument();
    rerender(<MetricCard label="cw" count={1} icon={icon} compact warn />);
    expect(screen.getByText("cw")).toBeInTheDocument();
  });
});
