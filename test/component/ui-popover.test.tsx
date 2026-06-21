// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";

describe("Popover", () => {
  it("opens on trigger and renders header/title/description", async () => {
    render(
      <Popover>
        <PopoverAnchor />
        <PopoverTrigger>פתח</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>כותרת</PopoverTitle>
            <PopoverDescription>תיאור</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>,
    );
    expect(screen.queryByText("כותרת")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("פתח"));
    expect(screen.getByText("כותרת")).toBeInTheDocument();
    expect(screen.getByText("תיאור")).toBeInTheDocument();
  });

  it("supports a custom align prop", async () => {
    render(
      <Popover>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent align="start">תוכן</PopoverContent>
      </Popover>,
    );
    await userEvent.click(screen.getByText("open"));
    expect(
      document.querySelector('[data-slot="popover-content"]'),
    ).toBeInTheDocument();
  });
});
