// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppNav } from "@/components/layout/app-nav";

const pathRef = { value: "/dashboard" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathRef.value,
}));

describe("AppNav", () => {
  it("renders all nav group labels and links", () => {
    pathRef.value = "/dashboard";
    render(<AppNav />);
    expect(screen.getByText("ניהול יומי")).toBeInTheDocument();
    expect(screen.getAllByRole("link").length).toBeGreaterThan(5);
  });

  it("marks the current route as active via aria-current (sidebar variant)", () => {
    pathRef.value = "/bookings";
    render(<AppNav />);
    const active = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("aria-current") === "page");
    expect(active).toBeTruthy();
    expect(active).toHaveClass("active");
  });

  it("treats nested routes as active (startsWith)", () => {
    pathRef.value = "/clients/123";
    render(<AppNav />);
    const active = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("aria-current") === "page");
    expect(active?.getAttribute("href")).toBe("/clients");
  });

  it("renders the light variant with active inline styling", () => {
    pathRef.value = "/clients";
    render(<AppNav light />);
    const active = screen
      .getAllByRole("link")
      .find((l) => l.getAttribute("aria-current") === "page") as HTMLElement;
    // The light-variant active link now uses the soft brand gradient token.
    expect(active.getAttribute("style")).toContain("var(--brand-gradient-soft)");
  });
});
