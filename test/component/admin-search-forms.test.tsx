// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
}));

import { BusinessesSearch } from "@/app/admin/businesses/_components/businesses-search";
import { AdminClientsSearch } from "@/app/admin/clients/_components/admin-clients-search";

beforeEach(() => vi.clearAllMocks());

describe("BusinessesSearch", () => {
  it("pushes a trimmed query string on submit", async () => {
    render(<BusinessesSearch defaultQ="" defaultStatus="" defaultPlan="" />);
    await userEvent.type(
      screen.getByPlaceholderText(/חיפוש לפי שם עסק/),
      "  סטודיו  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "חיפוש" }));
    expect(m.push).toHaveBeenCalledWith("/admin/businesses?q=%D7%A1%D7%98%D7%95%D7%93%D7%99%D7%95");
  });

  it("submits immediately when a status filter changes", async () => {
    render(<BusinessesSearch defaultQ="" defaultStatus="" defaultPlan="" />);
    const statusSelect = screen.getByDisplayValue("כל הסטטוסים");
    await userEvent.selectOptions(statusSelect, "active");
    expect(m.push).toHaveBeenCalledWith("/admin/businesses?status=active");
  });

  it("includes plan in the query when chosen", async () => {
    render(<BusinessesSearch defaultQ="" defaultStatus="" defaultPlan="" />);
    const planSelect = screen.getByDisplayValue("כל התוכניות");
    await userEvent.selectOptions(planSelect, "pro");
    expect(m.push).toHaveBeenCalledWith("/admin/businesses?plan=pro");
  });

  it("seeds inputs from default props", () => {
    render(<BusinessesSearch defaultQ="abc" defaultStatus="trial" defaultPlan="basic" />);
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("בתקופת ניסיון")).toBeInTheDocument();
    expect(screen.getByDisplayValue("בסיס ₪149")).toBeInTheDocument();
  });
});

describe("AdminClientsSearch", () => {
  it("pushes the query on submit", async () => {
    render(<AdminClientsSearch defaultQ="" />);
    await userEvent.type(screen.getByPlaceholderText(/חיפוש לפי שם לקוחה/), "עדי");
    await userEvent.click(screen.getByRole("button", { name: "חיפוש" }));
    expect(m.push).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/clients\?q=/));
  });

  it("pushes an empty query string when the input is blank", async () => {
    render(<AdminClientsSearch defaultQ="" />);
    await userEvent.click(screen.getByRole("button", { name: "חיפוש" }));
    expect(m.push).toHaveBeenCalledWith("/admin/clients?");
  });

  it("shows a clear link only when there is an active query", () => {
    const { rerender } = render(<AdminClientsSearch defaultQ="" />);
    expect(screen.queryByText(/ניקוי/)).not.toBeInTheDocument();
    rerender(<AdminClientsSearch defaultQ="עדי" />);
    expect(screen.getByText(/ניקוי/)).toHaveAttribute("href", "/admin/clients");
  });
});
