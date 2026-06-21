// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "@/components/ui/button";

const variants = [
  "primary",
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
] as const;
const sizes = ["sm", "md", "default", "lg", "icon"] as const;

describe("Button", () => {
  it.each(variants)("renders %s variant", (variant) => {
    render(<Button variant={variant}>כפתור</Button>);
    expect(screen.getByRole("button", { name: "כפתור" })).toBeInTheDocument();
  });

  it.each(sizes)("renders %s size", (size) => {
    render(<Button size={size}>גודל</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("applies gradient inline style for primary/default", () => {
    render(<Button variant="primary">grad</Button>);
    expect(screen.getByRole("button").getAttribute("style")).toContain(
      "linear-gradient",
    );
  });

  it("applies destructive inline style", () => {
    render(<Button variant="destructive">del</Button>);
    expect(screen.getByRole("button").getAttribute("style")).toContain(
      "linear-gradient",
    );
  });

  it("uses plain style for non-gradient variants and merges custom style", () => {
    render(
      <Button variant="secondary" style={{ marginTop: "4px" }}>
        sec
      </Button>,
    );
    const style = screen.getByRole("button").getAttribute("style") ?? "";
    expect(style).toContain("margin-top");
    expect(style).not.toContain("linear-gradient");
  });

  it("defaults type to button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>לחץ</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("honors an explicit type", () => {
    render(<Button type="submit">submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("buttonVariants returns a class string", () => {
    expect(typeof buttonVariants({ variant: "ghost", size: "lg" })).toBe(
      "string",
    );
  });
});
