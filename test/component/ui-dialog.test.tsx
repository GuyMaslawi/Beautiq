// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

function Example({
  showCloseButton,
  footerClose,
}: {
  showCloseButton?: boolean;
  footerClose?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger>פתח חלון</DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>כותרת</DialogTitle>
          <DialogDescription>תיאור</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={footerClose}>
          <DialogClose>סגור</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens on trigger and shows title/description", async () => {
    render(<Example />);
    expect(screen.queryByText("כותרת")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("פתח חלון"));
    expect(screen.getByText("כותרת")).toBeInTheDocument();
    expect(screen.getByText("תיאור")).toBeInTheDocument();
  });

  it("renders the corner close (sr-only X) and a footer close button", async () => {
    render(<Example footerClose />);
    await userEvent.click(screen.getByText("פתח חלון"));
    // corner close + footer "Close" button both expose the accessible name "Close"
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBe(2);
  });

  it("hides the corner close button when showCloseButton=false", async () => {
    render(<Example showCloseButton={false} />);
    await userEvent.click(screen.getByText("פתח חלון"));
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("closes when the close control is activated", async () => {
    render(<Example />);
    await userEvent.click(screen.getByText("פתח חלון"));
    await userEvent.click(screen.getByText("סגור"));
    expect(screen.queryByText("כותרת")).not.toBeInTheDocument();
  });
});
