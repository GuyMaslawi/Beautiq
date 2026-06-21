// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumPageShell } from "@/components/premium/page-shell";

const widths = ["narrow", "default", "wide", "full"] as const;

describe("PremiumPageShell", () => {
  it("renders children with the aura surface", () => {
    const { container } = render(
      <PremiumPageShell>
        <p>תוכן עמוד</p>
      </PremiumPageShell>,
    );
    expect(screen.getByText("תוכן עמוד")).toBeInTheDocument();
    expect(container.querySelector(".aura-surface")).toBeInTheDocument();
  });

  it.each(widths)("renders width=%s", (width) => {
    render(
      <PremiumPageShell width={width}>
        <span>w</span>
      </PremiumPageShell>,
    );
    expect(screen.getByText("w")).toBeInTheDocument();
  });

  it("applies the loose gap and a custom tint/className", () => {
    const { container } = render(
      <PremiumPageShell gap="loose" tint="plum" className="extra">
        <span>g</span>
      </PremiumPageShell>,
    );
    const inner = container.querySelector(".extra") as HTMLElement;
    expect(inner.className).toContain("space-y-10");
    expect(inner).toHaveAttribute("dir", "rtl");
  });
});
