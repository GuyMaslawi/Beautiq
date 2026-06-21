// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { BeautyPageHero } from "@/components/premium/page-hero";

describe("BeautyPageHero", () => {
  it("renders the title only (minimal)", () => {
    render(<BeautyPageHero title="לוח הבקרה" />);
    expect(
      screen.getByRole("heading", { name: "לוח הבקרה" }),
    ).toBeInTheDocument();
  });

  it("renders icon, eyebrow, subtitle, stats, action and aside", () => {
    render(
      <BeautyPageHero
        icon={Sparkles}
        eyebrow="ברוכה הבאה"
        title="היי"
        subtitle="סיכום היום"
        tint="mauve"
        stats={[{ label: "תורים", value: 3 }]}
        aside={<div>צד</div>}
        action={<button>תור חדש</button>}
      />,
    );
    expect(screen.getByText("ברוכה הבאה")).toBeInTheDocument();
    expect(screen.getByText("סיכום היום")).toBeInTheDocument();
    expect(screen.getByText("תורים")).toBeInTheDocument();
    expect(screen.getByText("צד")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "תור חדש" })).toBeInTheDocument();
  });
});
