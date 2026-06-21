// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders unchecked state with aria-checked=false", () => {
    render(<Switch checked={false} onCheckedChange={() => {}} aria-label="הפעל" />);
    const el = screen.getByRole("switch", { name: "הפעל" });
    expect(el).toHaveAttribute("aria-checked", "false");
  });

  it("renders checked state with gradient background", () => {
    render(<Switch checked onCheckedChange={() => {}} aria-label="פעיל" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("toggles by calling onCheckedChange with the inverse value", async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="t" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", async () => {
    const onChange = vi.fn();
    render(
      <Switch checked onCheckedChange={onChange} disabled aria-label="d" />,
    );
    const el = screen.getByRole("switch");
    expect(el).toBeDisabled();
    await userEvent.click(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies id, aria-labelledby and className", () => {
    render(
      <Switch
        checked={false}
        onCheckedChange={() => {}}
        id="sw1"
        aria-labelledby="lbl"
        className="x"
      />,
    );
    const el = screen.getByRole("switch");
    expect(el).toHaveAttribute("id", "sw1");
    expect(el).toHaveAttribute("aria-labelledby", "lbl");
    expect(el.className).toContain("x");
  });
});
