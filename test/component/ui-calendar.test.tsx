// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "@/components/ui/calendar";

describe("Calendar", () => {
  it("renders a month grid with day buttons", () => {
    render(<Calendar month={new Date(2026, 0, 1)} />);
    expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
    // A known day in January 2026.
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("navigates between months via the nav buttons (Chevron)", async () => {
    render(<Calendar month={new Date(2026, 0, 1)} />);
    const next = screen.getByRole("button", { name: /next/i });
    await userEvent.click(next);
    const prev = screen.getByRole("button", { name: /previous/i });
    await userEvent.click(prev);
    expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });

  it("selects a day in single mode", async () => {
    const onSelect = vi.fn();
    render(
      <Calendar
        mode="single"
        month={new Date(2026, 0, 1)}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByText("10"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("supports the dropdown caption layout", () => {
    render(
      <Calendar month={new Date(2026, 0, 1)} captionLayout="dropdown" />,
    );
    expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });

  it("renders week numbers when requested", () => {
    render(<Calendar month={new Date(2026, 0, 1)} showWeekNumber />);
    expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });
});
