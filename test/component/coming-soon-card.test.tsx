// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonCard } from "@/components/automations/coming-soon-card";

describe("ComingSoonCard", () => {
  it("renders the title, description and 'בקרוב' status", () => {
    render(<ComingSoonCard title="קמפיינים" description="שליחת מבצעים ללקוחות" />);
    expect(screen.getByText("קמפיינים")).toBeInTheDocument();
    expect(screen.getByText("שליחת מבצעים ללקוחות")).toBeInTheDocument();
    expect(screen.getByText("בקרוב")).toBeInTheDocument();
  });

  it("renders a disabled settings button", () => {
    render(<ComingSoonCard title="קמפיינים" description="תיאור" />);
    const btn = screen.getByRole("button", { name: /הגדרות/ });
    expect(btn).toBeDisabled();
  });

  it("renders a disabled switch labelled by the title", () => {
    render(<ComingSoonCard title="קמפיינים" description="תיאור" />);
    const sw = screen.getByRole("switch", { name: "קמפיינים" });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });
});
