// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AuraBlob } from "@/components/premium/aura-blob";

describe("AuraBlob", () => {
  it("renders an animated blob by default", () => {
    const { container } = render(<AuraBlob />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("aura-blob");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("omits the animation class when still", () => {
    const { container } = render(<AuraBlob still color="red" size={100} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).not.toHaveClass("aura-blob");
    expect(el.getAttribute("style")).toContain("red");
  });

  it("merges custom style and className", () => {
    const { container } = render(
      <AuraBlob className="x" style={{ top: 5 }} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("x");
    expect(el.getAttribute("style")).toContain("top");
  });
});
