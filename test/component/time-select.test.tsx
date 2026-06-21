// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TimeSelect } from "@/components/availability/time-select";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TimeSelect", () => {
  it("renders the empty placeholder option and the full 15-minute range", () => {
    render(<TimeSelect value="" onChange={() => {}} />);
    const select = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "בחירה…" })).toBeInTheDocument();
    // Boundaries: 06:00 first slot and 23:45 last slot.
    expect(screen.getByRole("option", { name: "06:00" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "23:45" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "12:15" })).toBeInTheDocument();
    // 06:00..23:45 in 15-min steps = 18 hours * 4 = 72, plus the placeholder.
    expect(select.querySelectorAll("option").length).toBe(73);
  });

  it("reflects the controlled value", () => {
    render(<TimeSelect value="09:30" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveValue("09:30");
  });

  it("calls onChange with the selected value", async () => {
    const onChange = vi.fn();
    render(<TimeSelect value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "10:15");
    expect(onChange).toHaveBeenCalledWith("10:15");
  });

  it("applies id and name when provided", () => {
    render(<TimeSelect id="t1" name="startTime" value="" onChange={() => {}} />);
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("id", "t1");
    expect(select).toHaveAttribute("name", "startTime");
  });

  it("adds the error border class only when hasError is set, and merges extra className", () => {
    const { rerender } = render(
      <TimeSelect value="" onChange={() => {}} className="extra-class" />,
    );
    let select = screen.getByRole("combobox");
    expect(select.className).not.toContain("border-red-400");
    expect(select.className).toContain("extra-class");

    rerender(<TimeSelect value="" onChange={() => {}} hasError />);
    select = screen.getByRole("combobox");
    expect(select.className).toContain("border-red-400");
  });
});
