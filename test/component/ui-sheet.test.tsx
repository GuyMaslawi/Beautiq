// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

const sides = ["right", "left", "top", "bottom"] as const;

function Example({
  side,
  showCloseButton,
}: {
  side?: (typeof sides)[number];
  showCloseButton?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger>פתח מגירה</SheetTrigger>
      <SheetContent side={side} showCloseButton={showCloseButton}>
        <SheetHeader>
          <SheetTitle>כותרת</SheetTitle>
          <SheetDescription>תיאור</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose>סגור</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("opens and shows title/description", async () => {
    render(<Example />);
    await userEvent.click(screen.getByText("פתח מגירה"));
    expect(screen.getByText("כותרת")).toBeInTheDocument();
    expect(screen.getByText("תיאור")).toBeInTheDocument();
  });

  it.each(sides)("renders %s side", async (side) => {
    render(<Example side={side} />);
    await userEvent.click(screen.getByText("פתח מגירה"));
    expect(
      document.querySelector('[data-slot="sheet-content"]'),
    ).toBeInTheDocument();
  });

  it("hides the close button when showCloseButton=false", async () => {
    render(<Example showCloseButton={false} />);
    await userEvent.click(screen.getByText("פתח מגירה"));
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("closes via the close control", async () => {
    render(<Example />);
    await userEvent.click(screen.getByText("פתח מגירה"));
    await userEvent.click(screen.getByText("סגור"));
    expect(screen.queryByText("כותרת")).not.toBeInTheDocument();
  });
});
