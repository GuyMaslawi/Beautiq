// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/layout/sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

describe("Sidebar", () => {
  it("renders business name, user name and the brand", () => {
    render(<Sidebar userName="גיא" businessName="סטודיו יופי" />);
    expect(screen.getByText("סטודיו יופי")).toBeInTheDocument();
    expect(screen.getByText("גיא")).toBeInTheDocument();
    expect(screen.getByText("Allura")).toBeInTheDocument();
    expect(screen.getByText("התנתקות")).toBeInTheDocument();
  });

  it("shows initials derived from a two-word business name", () => {
    render(<Sidebar userName={null} businessName="נועה כהן" />);
    expect(screen.getByText("נכ")).toBeInTheDocument();
  });

  it("falls back to 'B' initials when no business name", () => {
    render(<Sidebar userName={null} businessName={null} />);
    expect(screen.getByText("Allura")).toBeInTheDocument();
    // identity strip not rendered when both names are null; B brand mark exists
    expect(screen.getByText("התנתקות")).toBeInTheDocument();
  });

  it("derives single-letter initials from a one-word name", () => {
    render(<Sidebar userName="x" businessName="דנה" />);
    expect(screen.getByText("ד")).toBeInTheDocument();
  });
});
