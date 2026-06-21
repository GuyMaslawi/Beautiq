// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders a text input by default and forwards props", () => {
    render(<Input placeholder="הקלד כאן" defaultValue="abc" />);
    const el = screen.getByPlaceholderText("הקלד כאן") as HTMLInputElement;
    expect(el).toHaveAttribute("type", "text");
    expect(el.value).toBe("abc");
  });

  it("honors an explicit type", () => {
    render(<Input type="email" placeholder="מייל" />);
    expect(screen.getByPlaceholderText("מייל")).toHaveAttribute(
      "type",
      "email",
    );
  });

  it("wraps with the icon container when iconRight is provided", () => {
    render(
      <Input
        placeholder="חיפוש"
        iconRight={<span data-testid="icon">x</span>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("חיפוש").className).toContain("pr-10");
  });

  it("merges a custom className", () => {
    render(<Input className="my-input" placeholder="p" />);
    expect(screen.getByPlaceholderText("p").className).toContain("my-input");
  });
});
