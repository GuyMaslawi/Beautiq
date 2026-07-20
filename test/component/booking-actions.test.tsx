// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BOOKINGS } from "@/lib/constants/he";

const A = BOOKINGS.actions;

function makeActions() {
  return {
    completeAction: vi.fn(async () => {}),
    cancelAction: vi.fn(async () => {}),
    noShowAction: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingActions — visibility by status", () => {
  it.each(["completed", "cancelled", "no_show", "rescheduled"] as const)(
    "renders nothing for a %s booking",
    (status) => {
      const { container } = render(
        <BookingActions status={status} {...makeActions()} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("shows complete + no-show + cancel for pending/approved bookings (no approval step)", () => {
    for (const status of ["pending", "approved"] as const) {
      const { unmount } = render(
        <BookingActions status={status} {...makeActions()} />,
      );
      expect(screen.getByRole("button", { name: A.complete })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: A.noShow })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: A.cancel })).toBeInTheDocument();
      expect(screen.getByText(A.sectionTitle)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("BookingActions — running actions", () => {
  it("calls completeAction and shows its success message", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<BookingActions status="approved" {...actions} />);

    await user.click(screen.getByRole("button", { name: A.complete }));
    expect(actions.completeAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(A.successComplete)).toBeInTheDocument(),
    );
  });

  it("calls noShowAction with its success message", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<BookingActions status="approved" {...actions} />);

    await user.click(screen.getByRole("button", { name: A.noShow }));
    expect(actions.noShowAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(A.successNoShow)).toBeInTheDocument(),
    );
  });

  it("calls cancelAction with its success message", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<BookingActions status="pending" {...actions} />);

    await user.click(screen.getByRole("button", { name: A.cancel }));
    expect(actions.cancelAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(A.successCancel)).toBeInTheDocument(),
    );
  });
});
