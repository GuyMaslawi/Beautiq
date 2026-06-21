// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders title and body with default star icon", () => {
    render(<EmptyState title="אין תורים" body="עדיין לא נקבעו תורים" />);
    expect(screen.getByText("אין תורים")).toBeInTheDocument();
    expect(screen.getByText("עדיין לא נקבעו תורים")).toBeInTheDocument();
    expect(screen.getByText("✦")).toBeInTheDocument();
  });

  it("renders a custom icon instead of the default", () => {
    render(
      <EmptyState
        title="t"
        body="b"
        icon={<span data-testid="custom-icon">i</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(screen.queryByText("✦")).not.toBeInTheDocument();
  });

  it("renders the CTA link when both cta and ctaHref are provided", () => {
    render(
      <EmptyState title="t" body="b" cta="קביעת תור" ctaHref="/bookings/new" />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bookings/new");
    expect(link).toHaveTextContent("קביעת תור");
  });

  it("does not render a CTA when href is missing", () => {
    render(<EmptyState title="t" body="b" cta="קביעת תור" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
