// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeautyInsightCard } from "@/components/premium/insight-card";

describe("BeautyInsightCard", () => {
  it("renders title only (defaults)", () => {
    render(<BeautyInsightCard title="כותרת" />);
    expect(
      screen.getByRole("heading", { name: "כותרת" }),
    ).toBeInTheDocument();
  });

  it("renders icon, eyebrow, body, value, valueLabel, action and children", () => {
    render(
      <BeautyInsightCard
        tone="gold"
        icon={<i data-testid="ic" />}
        eyebrow="המלצה"
        title="העלאת מחיר"
        body="הכנסות עלו"
        value="₪1,240"
        valueLabel="פוטנציאל"
        action={<button>בצע</button>}
      >
        <span data-testid="child">תוכן נוסף</span>
      </BeautyInsightCard>,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    expect(screen.getByText("המלצה")).toBeInTheDocument();
    expect(screen.getByText("הכנסות עלו")).toBeInTheDocument();
    expect(screen.getByText("₪1,240")).toBeInTheDocument();
    expect(screen.getByText("פוטנציאל")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "בצע" })).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders the featured (hero band) layout", () => {
    render(<BeautyInsightCard title="hero" featured value="₪5" />);
    expect(screen.getByText("hero")).toBeInTheDocument();
  });
});
