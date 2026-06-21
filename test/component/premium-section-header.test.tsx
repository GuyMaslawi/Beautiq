// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorialSectionHeader } from "@/components/premium/section-header";

describe("EditorialSectionHeader", () => {
  it("renders the title only", () => {
    render(<EditorialSectionHeader title="תורים היום" />);
    expect(
      screen.getByRole("heading", { name: "תורים היום" }),
    ).toBeInTheDocument();
  });

  it("renders eyebrow, icon, description and action", () => {
    render(
      <EditorialSectionHeader
        eyebrow="01"
        icon={<i data-testid="ic" />}
        title="t"
        description="הסבר"
        tint="champagne"
        action={<button>הכל</button>}
      />,
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    expect(screen.getByText("הסבר")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הכל" })).toBeInTheDocument();
  });
});
