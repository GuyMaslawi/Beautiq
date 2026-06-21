// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "@/components/ui/section";

describe("Section", () => {
  it("renders title and children", () => {
    render(
      <Section title="הגדרות העסק">
        <p>תוכן</p>
      </Section>,
    );
    expect(
      screen.getByRole("heading", { name: "הגדרות העסק" }),
    ).toBeInTheDocument();
    expect(screen.getByText("תוכן")).toBeInTheDocument();
  });

  it("renders the icon bubble when icon is provided", () => {
    render(
      <Section title="t" icon={<span data-testid="ic">i</span>}>
        c
      </Section>,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });

  it("renders the action slot", () => {
    render(
      <Section title="t" action={<button>פעולה</button>}>
        c
      </Section>,
    );
    expect(screen.getByRole("button", { name: "פעולה" })).toBeInTheDocument();
  });
});
