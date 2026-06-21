// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders with default rows=4 and forwards props", () => {
    render(<Textarea placeholder="הערות" defaultValue="abc" />);
    const el = screen.getByPlaceholderText("הערות") as HTMLTextAreaElement;
    expect(el).toHaveAttribute("rows", "4");
    expect(el.value).toBe("abc");
  });

  it("honors a custom rows value and className", () => {
    render(<Textarea rows={8} className="ta" placeholder="p" />);
    const el = screen.getByPlaceholderText("p");
    expect(el).toHaveAttribute("rows", "8");
    expect(el.className).toContain("ta");
  });
});
