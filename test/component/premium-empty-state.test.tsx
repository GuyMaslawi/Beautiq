// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PremiumEmptyState } from "@/components/premium/empty-state";

describe("PremiumEmptyState", () => {
  it("renders title, body and the default star medallion", () => {
    render(<PremiumEmptyState title="ריק" body="אין נתונים" />);
    expect(screen.getByText("ריק")).toBeInTheDocument();
    expect(screen.getByText("אין נתונים")).toBeInTheDocument();
    expect(screen.getByText("✦")).toBeInTheDocument();
  });

  it("renders the CTA link when cta + ctaHref are present", () => {
    render(
      <PremiumEmptyState title="t" body="b" cta="הוסף" ctaHref="/new" />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/new");
  });

  it("prefers ctaAction over the link CTA and renders orbit + custom icon", () => {
    render(
      <PremiumEmptyState
        title="t"
        body="b"
        icon={<i data-testid="ic" />}
        ctaAction={<button>פעולה</button>}
        orbit={[<i key="1" data-testid="o1" />, <i key="2" data-testid="o2" />]}
        tint="sage"
      />,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    expect(screen.getByTestId("o1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "פעולה" })).toBeInTheDocument();
    expect(screen.queryByText("✦")).not.toBeInTheDocument();
  });
});
