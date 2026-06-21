// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select";

// jsdom lacks pointer/scroll APIs radix-select relies on.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function Example({ size }: { size?: "sm" | "default" }) {
  return (
    <Select>
      <SelectTrigger size={size} aria-label="בחר שירות">
        <SelectValue placeholder="בחר שירות" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>שירותים</SelectLabel>
          <SelectItem value="mani">מניקור</SelectItem>
          <SelectSeparator />
          <SelectItem value="pedi">פדיקור</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("renders the placeholder on the trigger", () => {
    render(<Example />);
    expect(screen.getByText("בחר שירות")).toBeInTheDocument();
  });

  it("opens and selects an item", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByText("מניקור");
    await userEvent.click(option);
    expect(screen.getByRole("combobox")).toHaveTextContent("מניקור");
  });

  it("renders the sm size trigger", () => {
    render(<Example size="sm" />);
    expect(
      document.querySelector('[data-slot="select-trigger"]'),
    ).toHaveAttribute("data-size", "sm");
  });
});
