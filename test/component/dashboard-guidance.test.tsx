// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import React from "react";
import { GuidanceCard } from "@/components/dashboard/guidance-card";
import { BusinessGuidance } from "@/components/dashboard/business-guidance";
import type { GuidanceItem } from "@/lib/guidance/rules";

function item(over: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    id: "g1",
    priority: "important",
    title: "יש לך 3 לקוחות שלא קבעו תור",
    description: "כדאי לשלוח להן הודעה",
    href: "/bring-back",
    actionLabel: "להחזרת לקוחות",
    ...over,
  } as GuidanceItem;
}

describe("GuidanceCard", () => {
  it("renders an important item with its title, description, priority label and link", () => {
    render(<GuidanceCard item={item()} />);
    expect(screen.getByText("יש לך 3 לקוחות שלא קבעו תור")).toBeInTheDocument();
    expect(screen.getByText("כדאי לשלוח להן הודעה")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /להחזרת לקוחות/ });
    expect(link.getAttribute("href")).toBe("/bring-back");
  });

  it("renders the recommended priority variant", () => {
    render(<GuidanceCard item={item({ priority: "recommended" })} />);
    // recommended priority label should be present (distinct from important)
    expect(screen.getByText("להחזרת לקוחות")).toBeInTheDocument();
  });

  it("renders the info priority variant", () => {
    render(<GuidanceCard item={item({ priority: "info" })} />);
    expect(screen.getByText("יש לך 3 לקוחות שלא קבעו תור")).toBeInTheDocument();
  });
});

describe("BusinessGuidance", () => {
  it("renders the all-clear state when there are no items", () => {
    render(<BusinessGuidance items={[]} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
    // No guidance cards rendered
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a card per guidance item", () => {
    render(
      <BusinessGuidance
        items={[item({ id: "a" }), item({ id: "b", title: "מחר יש חלון פנוי", href: "/bring-back?tab=slots" })]}
      />,
    );
    expect(screen.getByText("יש לך 3 לקוחות שלא קבעו תור")).toBeInTheDocument();
    expect(screen.getByText("מחר יש חלון פנוי")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
