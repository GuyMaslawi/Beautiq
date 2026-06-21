// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import React from "react";
import { BringBackTabs } from "@/components/bring-back/bring-back-tabs";

describe("BringBackTabs", () => {
  it("renders all four main tabs with correct hrefs", () => {
    render(<BringBackTabs activeTab="clients" activeSub="overview" />);
    expect(screen.getByRole("link", { name: "לקוחות שלא חזרו" }).getAttribute("href")).toBe(
      "/bring-back?tab=clients",
    );
    expect(screen.getByRole("link", { name: "מילוי שעות ריקות" }).getAttribute("href")).toBe(
      "/bring-back?tab=slots",
    );
    expect(screen.getByRole("link", { name: "ביקורות" }).getAttribute("href")).toBe(
      "/bring-back?tab=reviews",
    );
    expect(screen.getByRole("link", { name: "הודעות" }).getAttribute("href")).toBe(
      "/bring-back?tab=messages",
    );
  });

  it("marks the active main tab with aria-current", () => {
    render(<BringBackTabs activeTab="slots" activeSub="overview" />);
    expect(screen.getByRole("link", { name: "מילוי שעות ריקות" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ביקורות" })).not.toHaveAttribute("aria-current");
  });

  it("renders sub-tabs only for the clients tab with correct hrefs and active state", () => {
    render(<BringBackTabs activeTab="clients" activeSub="retention" />);
    const retention = screen.getByRole("link", { name: "שימור" });
    expect(retention.getAttribute("href")).toBe("/bring-back?tab=clients&sub=retention");
    expect(retention).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "סקירה" }).getAttribute("href")).toBe(
      "/bring-back?tab=clients&sub=overview",
    );
    expect(screen.getByRole("link", { name: "בסיכון" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "קמפיינים" })).toBeInTheDocument();
  });

  it("hides sub-tabs for non-clients tabs", () => {
    render(<BringBackTabs activeTab="reviews" activeSub="overview" />);
    expect(screen.queryByRole("link", { name: "שימור" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "קמפיינים" })).not.toBeInTheDocument();
  });
});
