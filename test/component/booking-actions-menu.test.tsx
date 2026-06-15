// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingActionsMenu } from "@/components/bookings/booking-actions-menu";
import { BOOKINGS } from "@/lib/constants/he";

// Hoisted spies for the server actions + router so the module mocks can use them.
const m = vi.hoisted(() => ({
  approveBookingAction: vi.fn(() => Promise.resolve()),
  completeBookingAction: vi.fn(() => Promise.resolve()),
  cancelBookingAction: vi.fn(() => Promise.resolve()),
  noShowBookingAction: vi.fn(() => Promise.resolve()),
  push: vi.fn(),
}));

vi.mock("@/server/bookings/actions", () => ({
  approveBookingAction: m.approveBookingAction,
  completeBookingAction: m.completeBookingAction,
  cancelBookingAction: m.cancelBookingAction,
  noShowBookingAction: m.noShowBookingAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push }),
}));

// Render motion elements as plain divs without forwarding animation-only props.
vi.mock("motion/react", async () => {
  const React = await import("react");
  const ANIM = new Set(["initial", "animate", "exit", "transition"]);
  const strip = (props: Record<string, unknown>) => {
    const rest: Record<string, unknown> = {};
    for (const key in props) {
      if (!ANIM.has(key)) rest[key] = props[key];
    }
    return React.createElement("div", rest);
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: () => strip }),
  };
});

const A = BOOKINGS.rowActions;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingActionsMenu — primary action", () => {
  it("shows 'אישור תור' as the primary button for a pending booking", () => {
    render(<BookingActionsMenu bookingId="b1" status="pending" />);
    expect(screen.getByRole("button", { name: A.approve })).toBeInTheDocument();
  });

  it("runs approveBookingAction immediately (no confirm) when the primary is clicked", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="pending" />);
    await user.click(screen.getByRole("button", { name: A.approve }));
    expect(m.approveBookingAction).toHaveBeenCalledWith("b1");
  });

  it("shows 'סימון כהושלם' as the primary button for an approved booking", () => {
    render(<BookingActionsMenu bookingId="b2" status="approved" />);
    expect(screen.getByRole("button", { name: A.complete })).toBeInTheDocument();
  });

  it("shows a non-destructive 'צפייה' primary for completed bookings and navigates on click", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b3" status="completed" />);
    await user.click(screen.getByRole("button", { name: A.viewShort }));
    expect(m.push).toHaveBeenCalledWith("/bookings/b3");
  });
});

describe("BookingActionsMenu — menu", () => {
  it("opens a menu of text-labeled actions (no icon-only items)", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="pending" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    expect(within(menu).getByRole("menuitem", { name: A.cancel })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: A.noShow })).toBeInTheDocument();
  });

  it("does not expose invalid status-transition actions for a completed booking", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b3" status="completed" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: A.cancel })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: A.noShow })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: A.review })).toBeInTheDocument();
  });
});

describe("BookingActionsMenu — destructive confirmation", () => {
  it("requires confirmation before cancelling and only then calls the server action", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="approved" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    await user.click(screen.getByRole("menuitem", { name: A.cancel }));

    // Action must NOT have run yet — a confirm dialog appears first.
    expect(m.cancelBookingAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(A.confirmCancel.title)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: A.confirmCancel.confirm }));
    expect(m.cancelBookingAction).toHaveBeenCalledWith("b1");
  });

  it("does not cancel when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="approved" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    await user.click(screen.getByRole("menuitem", { name: A.cancel }));

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: A.confirmCancel.cancel }));

    expect(m.cancelBookingAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("requires confirmation before marking no-show", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="approved" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    await user.click(screen.getByRole("menuitem", { name: A.noShow }));

    expect(m.noShowBookingAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: A.confirmNoShow.confirm }));
    expect(m.noShowBookingAction).toHaveBeenCalledWith("b1");
  });
});

describe("BookingActionsMenu — accessibility & layout", () => {
  it("gives the row menu trigger a visible text label and aria-haspopup", () => {
    render(<BookingActionsMenu bookingId="b1" status="pending" />);
    const trigger = screen.getByRole("button", { name: A.more });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("uses an icon-only trigger with an accessible label in the compact card layout", () => {
    render(<BookingActionsMenu bookingId="b1" status="pending" layout="card" />);
    const trigger = screen.getByRole("button", { name: A.moreCompact });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-label", A.moreCompact);
  });

  it("closes the menu on Escape", async () => {
    const user = userEvent.setup();
    render(<BookingActionsMenu bookingId="b1" status="pending" />);

    await user.click(screen.getByRole("button", { name: A.more }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
