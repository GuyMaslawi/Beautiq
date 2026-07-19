// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceShowcaseCard } from "@/components/premium/service-showcase-card";

describe("ServiceShowcaseCard", () => {
  it("renders name with the default sparkles icon (minimal)", () => {
    const { container } = render(<ServiceShowcaseCard name="מניקור" />);
    expect(
      screen.getByRole("heading", { name: "מניקור" }),
    ).toBeInTheDocument();
    // with no custom icon, the default Sparkles lucide icon renders
    expect(container.querySelector(".lucide-sparkles")).toBeInTheDocument();
  });

  it("renders description, price, priceNote, duration, control, insight, footer and custom icon", () => {
    render(
      <ServiceShowcaseCard
        name="פדיקור"
        description="טיפול מלא"
        price="₪180"
        priceNote="כולל מע״מ"
        duration={<span>45 דק׳</span>}
        icon={<i data-testid="ic" />}
        control={<button>הפעל</button>}
        insight={<span>תובנה</span>}
        footer={<span>כותרת תחתית</span>}
        inactive
        selected
      />,
    );
    expect(screen.getByText("טיפול מלא")).toBeInTheDocument();
    expect(screen.getByText("₪180")).toBeInTheDocument();
    expect(screen.getByText("כולל מע״מ")).toBeInTheDocument();
    expect(screen.getByText("45 דק׳")).toBeInTheDocument();
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    expect(screen.getByText("תובנה")).toBeInTheDocument();
    expect(screen.getByText("כותרת תחתית")).toBeInTheDocument();
  });

  it("makes the header a button region when onSelect is provided", async () => {
    const onSelect = vi.fn();
    render(<ServiceShowcaseCard name="x" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
