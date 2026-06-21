// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const strip = () => React.createElement("div");
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

beforeAll(() => {
  // ScrollReset calls container.scrollTo, which jsdom does not implement.
  Element.prototype.scrollTo = vi.fn();
});

describe("AppShell", () => {
  it("renders the sidebar, header and main children", () => {
    render(
      <AppShell userName="גיא" businessName="סטודיו">
        <p>תוכן ראשי</p>
      </AppShell>,
    );
    expect(screen.getByText("תוכן ראשי")).toBeInTheDocument();
    // sidebar + mobile header both show the brand
    expect(screen.getAllByText("Allura").length).toBeGreaterThan(0);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("passes isAdmin down to the navigation", () => {
    render(
      <AppShell userName="x" businessName="x" isAdmin>
        <p>c</p>
      </AppShell>,
    );
    expect(screen.getAllByText("ניהול מערכת").length).toBeGreaterThan(0);
  });
});
