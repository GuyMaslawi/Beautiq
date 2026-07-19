// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), pathname: "/admin" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, refresh: m.refresh }),
  usePathname: () => m.pathname,
}));

import { AdminNav } from "@/app/admin/_components/admin-nav";
import { ClickableRow } from "@/app/admin/businesses/_components/clickable-row";
import { StopPropA, StopPropLink } from "@/app/admin/businesses/_components/stop-prop-link";

beforeEach(() => {
  vi.clearAllMocks();
  m.pathname = "/admin";
});

describe("AdminNav", () => {
  it("renders all Hebrew nav labels", () => {
    render(<AdminNav />);
    expect(screen.getByText("סקירה")).toBeInTheDocument();
    expect(screen.getByText("ניהול עסקים")).toBeInTheDocument();
    expect(screen.getByText("ניהול לקוחות")).toBeInTheDocument();
  });

  it("marks /admin active only on exact match (overview)", () => {
    m.pathname = "/admin";
    render(<AdminNav />);
    const overview = screen.getByText("סקירה");
    // active state is applied via the "active" class (styled in CSS)
    expect(overview).toHaveClass("active");
  });

  it("marks a section active when the pathname starts with its href", () => {
    m.pathname = "/admin/businesses/abc";
    render(<AdminNav />);
    expect(screen.getByText("ניהול עסקים")).toHaveClass("active");
    // overview is NOT active on a sub-route
    expect(screen.getByText("סקירה")).not.toHaveClass("active");
  });
});

describe("ClickableRow", () => {
  it("navigates to href on click", async () => {
    render(
      <table>
        <tbody>
          <ClickableRow href="/admin/businesses/x">
            <td>row</td>
          </ClickableRow>
        </tbody>
      </table>,
    );
    await userEvent.click(screen.getByText("row"));
    expect(m.push).toHaveBeenCalledWith("/admin/businesses/x");
  });
});

describe("StopProp link wrappers", () => {
  it("StopPropA stops click propagation so the row click does not fire", async () => {
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <StopPropA href="/x">קישור</StopPropA>
      </div>,
    );
    await userEvent.click(screen.getByText("קישור"));
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("StopPropLink renders an anchor and stops propagation", async () => {
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <StopPropLink href="/y">קישור פנימי</StopPropLink>
      </div>,
    );
    const link = screen.getByText("קישור פנימי");
    expect(link.closest("a")).toHaveAttribute("href", "/y");
    await userEvent.click(link);
    expect(rowClick).not.toHaveBeenCalled();
  });
});
