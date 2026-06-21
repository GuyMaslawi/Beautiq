// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, badgeVariants } from "@/components/ui/badge";

const variants = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const;

describe("Badge", () => {
  it.each(variants)("renders %s variant with data-variant", (variant) => {
    render(<Badge variant={variant}>תווית</Badge>);
    const el = screen.getByText("תווית");
    expect(el).toHaveAttribute("data-variant", variant);
    expect(el).toHaveAttribute("data-slot", "badge");
  });

  it("defaults to the default variant", () => {
    render(<Badge>ברירת מחדל</Badge>);
    expect(screen.getByText("ברירת מחדל")).toHaveAttribute(
      "data-variant",
      "default",
    );
  });

  it("renders as a span by default and as child when asChild", () => {
    const { rerender } = render(<Badge>span</Badge>);
    expect(screen.getByText("span").tagName).toBe("SPAN");
    rerender(
      <Badge asChild>
        <a href="/x">link</a>
      </Badge>,
    );
    expect(screen.getByText("link").tagName).toBe("A");
  });

  it("badgeVariants returns a class string", () => {
    expect(typeof badgeVariants({ variant: "secondary" })).toBe("string");
  });
});
