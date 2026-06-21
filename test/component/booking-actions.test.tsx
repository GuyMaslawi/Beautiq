// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BOOKINGS } from "@/lib/constants/he";

const A = BOOKINGS.actions;

function makeActions() {
  return {
    approveAction: vi.fn(async () => {}),
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

  it("shows approve + complete + no-show + cancel for a pending booking", () => {
    render(<BookingActions status="pending" {...makeActions()} />);
    expect(screen.getByRole("button", { name: A.approve })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.complete })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.noShow })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.cancel })).toBeInTheDocument();
    expect(screen.getByText(A.sectionTitle)).toBeInTheDocument();
  });

  it("hides the approve button for an approved booking (already approved)", () => {
    render(<BookingActions status="approved" {...makeActions()} />);
    expect(
      screen.queryByRole("button", { name: A.approve }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.complete })).toBeInTheDocument();
  });
});

describe("BookingActions — running actions", () => {
  it("calls approveAction and shows the success message", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<BookingActions status="pending" {...actions} />);

    await user.click(screen.getByRole("button", { name: A.approve }));
    expect(actions.approveAction).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(A.successApprove)).toBeInTheDocument(),
    );
  });

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
