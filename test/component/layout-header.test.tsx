// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/layout/header";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "layout",
    "variants",
  ]);
  const strip = (p: Record<string, unknown>) => {
    const r: Record<string, unknown> = {};
    for (const k in p) if (!ANIM.has(k)) r[k] = p[k];
    return React.createElement("div", r);
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("Header (mobile)", () => {
  it("renders the brand and a closed drawer initially", () => {
    render(<Header businessName="סטודיו" />);
    expect(screen.getByText("Allura")).toBeInTheDocument();
    expect(screen.queryByLabelText("סגור תפריט")).not.toBeInTheDocument();
  });

  it("opens the drawer and shows business name + nav", async () => {
    render(<Header businessName="סטודיו" />);
    await userEvent.click(screen.getByLabelText("פתח תפריט"));
    expect(screen.getByLabelText("סגור תפריט")).toBeInTheDocument();
    expect(screen.getByText("התנתקות")).toBeInTheDocument();
    expect(screen.getAllByText("סטודיו").length).toBeGreaterThan(0);
  });

  it("closes the drawer via the close button", async () => {
    render(<Header businessName="סטודיו" />);
    await userEvent.click(screen.getByLabelText("פתח תפריט"));
    await userEvent.click(screen.getByLabelText("סגור תפריט"));
    expect(screen.queryByLabelText("סגור תפריט")).not.toBeInTheDocument();
  });

  it("renders without the business avatar strip when no business name", async () => {
    render(<Header businessName={null} />);
    await userEvent.click(screen.getByLabelText("פתח תפריט"));
    expect(screen.getByLabelText("סגור תפריט")).toBeInTheDocument();
  });
});
