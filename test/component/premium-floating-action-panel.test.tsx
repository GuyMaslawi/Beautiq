// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingActionPanel } from "@/components/premium/floating-action-panel";

describe("FloatingActionPanel", () => {
  it("renders children floating (fixed) by default", () => {
    const { container } = render(
      <FloatingActionPanel>
        <button>תור חדש</button>
      </FloatingActionPanel>,
    );
    expect(screen.getByRole("button", { name: "תור חדש" })).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("fixed");
  });

  it("renders inline with a label", () => {
    const { container } = render(
      <FloatingActionPanel inline label="פעולות מהירות">
        <button>x</button>
      </FloatingActionPanel>,
    );
    expect(screen.getByText("פעולות מהירות")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("relative");
  });
});
