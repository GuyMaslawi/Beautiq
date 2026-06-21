// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

beforeAll(() => {
  // radix-tooltip uses ResizeObserver internally; jsdom lacks it.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
});

function Example() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>רמז</TooltipTrigger>
        <TooltipContent>הסבר קצר</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("renders the trigger with the tooltip-trigger slot", () => {
    render(<Example />);
    expect(
      document.querySelector('[data-slot="tooltip-trigger"]'),
    ).toBeInTheDocument();
    expect(screen.getByText("רמז")).toBeInTheDocument();
  });

  it("shows the tooltip content after focusing the trigger", async () => {
    render(<Example />);
    await userEvent.tab(); // focus the trigger
    expect(await screen.findAllByText("הסבר קצר")).not.toHaveLength(0);
  });
});
