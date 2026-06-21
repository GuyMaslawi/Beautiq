// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
});

describe("DropdownMenu", () => {
  it("opens and renders all item kinds", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>פעולות</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>תפריט</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem inset>אישור</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              מחיקה
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>תזכורת</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="x">
            <DropdownMenuRadioItem value="x">בחירה</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>עוד</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>תת-פריט</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByText("פעולות"));
    expect(screen.getByText("תפריט")).toBeInTheDocument();
    expect(screen.getByText("אישור")).toBeInTheDocument();
    expect(screen.getByText("מחיקה")).toBeInTheDocument();
    expect(screen.getByText("תזכורת")).toBeInTheDocument();
    expect(screen.getByText("בחירה")).toBeInTheDocument();
    expect(screen.getByText("עוד")).toBeInTheDocument();
  });

  it("fires onSelect of a menu item", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>בצע</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByText("open"));
    await userEvent.click(screen.getByText("בצע"));
    expect(onSelect).toHaveBeenCalled();
  });
});
