// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => {
  let nextState: unknown = {};
  return {
    addExceptionAction: vi.fn(async () => m.nextState),
    deleteExceptionAction: vi.fn(async () => ({})),
    get nextState() {
      return nextState;
    },
    set nextState(v: unknown) {
      nextState = v;
    },
  };
});

vi.mock("@/server/availability/actions", () => ({
  addExceptionAction: m.addExceptionAction,
  deleteExceptionAction: m.deleteExceptionAction,
}));

import {
  AvailabilityExceptions,
  type ExceptionRecord,
} from "@/components/availability/availability-exceptions";
import { AVAILABILITY, ACTIONS } from "@/lib/constants/he";

const EX = AVAILABILITY.exceptions;

const CLOSED_EX: ExceptionRecord = {
  id: "ex1",
  date: "2026-07-01",
  type: "closed",
  startMinutes: null,
  endMinutes: null,
  reason: "חופשה",
};

const HOURS_EX: ExceptionRecord = {
  id: "ex2",
  date: "2026-07-02",
  type: "custom_hours",
  startMinutes: 600,
  endMinutes: 780,
  reason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.nextState = {};
});

describe("AvailabilityExceptions", () => {
  it("renders the empty state when there are no exceptions", () => {
    render(<AvailabilityExceptions exceptions={[]} />);
    expect(screen.getByText(EX.title)).toBeInTheDocument();
    expect(screen.getByText(EX.noExceptions)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: EX.addButton }),
    ).toBeInTheDocument();
  });

  it("renders a closed exception row with reason and a delete button", () => {
    render(<AvailabilityExceptions exceptions={[CLOSED_EX]} />);
    // Closed type label appears in the row detail.
    expect(screen.getByText(/יום סגור/)).toBeInTheDocument();
    expect(screen.getByText("חופשה")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: EX.deleteButton }),
    ).toBeInTheDocument();
  });

  it("renders a custom-hours exception row showing the formatted time range", () => {
    render(<AvailabilityExceptions exceptions={[HOURS_EX]} />);
    // 600 -> 10:00, 780 -> 13:00.
    expect(screen.getByText(/10:00–13:00/)).toBeInTheDocument();
  });

  it("clicking delete submits to the bound delete action", async () => {
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[CLOSED_EX]} />);
    await user.click(screen.getByRole("button", { name: EX.deleteButton }));
    await waitFor(() => expect(m.deleteExceptionAction).toHaveBeenCalled());
  });

  it("opening the add form hides the add button and shows date/type fields", async () => {
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    expect(screen.getByLabelText(EX.dateLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(EX.typeLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ACTIONS.cancel }),
    ).toBeInTheDocument();
    // Time selects are hidden until "custom_hours" is chosen.
    expect(screen.queryByLabelText(EX.startTime)).not.toBeInTheDocument();
  });

  it("choosing 'custom hours' reveals the start/end time selects", async () => {
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    await user.selectOptions(screen.getByLabelText(EX.typeLabel), "custom_hours");
    expect(screen.getByLabelText(EX.startTime)).toBeInTheDocument();
    expect(screen.getByLabelText(EX.endTime)).toBeInTheDocument();
  });

  it("submits the add form with the entered values", async () => {
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    await user.type(screen.getByLabelText(EX.dateLabel), "2026-08-15");
    await user.selectOptions(screen.getByLabelText(EX.typeLabel), "closed");
    await user.type(
      screen.getByLabelText(`${EX.reasonLabel} (${EX.reasonOptional})`),
      "חג",
    );

    // The "add" submit button (inside the form). There are two add buttons named
    // identically (the header one is gone once the form is open); use the submit.
    await user.click(
      screen.getByRole("button", { name: EX.addButton }),
    );
    await waitFor(() => expect(m.addExceptionAction).toHaveBeenCalled());
    const fd = (m.addExceptionAction.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("date")).toBe("2026-08-15");
    expect(fd.get("type")).toBe("closed");
    expect(fd.get("reason")).toBe("חג");
  });

  it("renders a form error and field errors from the action", async () => {
    m.nextState = {
      formError: "שגיאה כללית",
      errors: { date: AVAILABILITY.errors.dateRequired },
    };
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    expect(await screen.findByText("שגיאה כללית")).toBeInTheDocument();
    expect(
      screen.getByText(AVAILABILITY.errors.dateRequired),
    ).toBeInTheDocument();
  });

  it("restores echoed values from the action state after a validation error", async () => {
    m.nextState = {
      values: {
        date: "2026-09-01",
        type: "custom_hours",
        startTime: "10:00",
        endTime: "12:00",
        reason: "בדיקה",
      },
      errors: { startTime: AVAILABILITY.errors.startRequired },
    };
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    await waitFor(() =>
      expect(screen.getByLabelText(EX.dateLabel)).toHaveValue("2026-09-01"),
    );
    // The echoed reason text is restored into the controlled input.
    expect(
      screen.getByLabelText(`${EX.reasonLabel} (${EX.reasonOptional})`),
    ).toHaveValue("בדיקה");
    // The validation error for the start time is surfaced.
    expect(
      screen.getByText(AVAILABILITY.errors.startRequired),
    ).toBeInTheDocument();
  });

  it("closes the add form when cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));
    expect(screen.getByLabelText(EX.dateLabel)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: ACTIONS.cancel }));
    expect(screen.queryByLabelText(EX.dateLabel)).not.toBeInTheDocument();
    expect(screen.getByText(EX.noExceptions)).toBeInTheDocument();
  });

  it("closes the add form automatically on a successful submit", async () => {
    m.nextState = { success: true };
    const user = userEvent.setup();
    render(<AvailabilityExceptions exceptions={[]} />);
    await user.click(screen.getByRole("button", { name: EX.addButton }));
    await user.click(screen.getByRole("button", { name: EX.addButton }));

    // setTimeout(onClose, 0) closes the form -> date field disappears.
    await waitFor(() =>
      expect(screen.queryByLabelText(EX.dateLabel)).not.toBeInTheDocument(),
    );
  });
});
