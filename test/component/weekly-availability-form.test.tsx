// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The form imports the server action directly and drives it via useActionState.
const m = vi.hoisted(() => {
  let nextState: unknown = {};
  return {
    saveWeeklyAvailabilityAction: vi.fn(async () => m.nextState),
    get nextState() {
      return nextState;
    },
    set nextState(v: unknown) {
      nextState = v;
    },
  };
});

vi.mock("@/server/availability/actions", () => ({
  saveWeeklyAvailabilityAction: m.saveWeeklyAvailabilityAction,
}));

import { WeeklyAvailabilityForm } from "@/components/availability/weekly-availability-form";
import { AVAILABILITY } from "@/lib/constants/he";

const W = AVAILABILITY.weekly;

beforeEach(() => {
  vi.clearAllMocks();
  m.nextState = {};
});

describe("WeeklyAvailabilityForm", () => {
  it("renders title, presets, all seven day rows and the empty summary", () => {
    render(<WeeklyAvailabilityForm initialRules={[]} />);
    expect(screen.getByText(W.title)).toBeInTheDocument();
    expect(screen.getByText(W.summary.empty)).toBeInTheDocument();
    // Preset buttons.
    expect(
      screen.getByRole("button", { name: W.presets.sunThu9to17 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: W.presets.withFriday }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: W.presets.clearAll }),
    ).toBeInTheDocument();
    // All 7 day names.
    for (let i = 0; i < 7; i++) {
      expect(screen.getByText(AVAILABILITY.days[i])).toBeInTheDocument();
    }
    // All days closed by default -> 7 "closed" badges + closed notes.
    expect(screen.getAllByText(W.closed).length).toBe(7);
    expect(screen.getAllByText(W.closedDayNote).length).toBe(7);
  });

  it("renders a saved summary derived from initialRules", () => {
    // Sunday(0) and Monday(1) 09:00-17:00 collapse into a range.
    render(
      <WeeklyAvailabilityForm
        initialRules={[
          { weekday: 0, startMinutes: 540, endMinutes: 1020 },
          { weekday: 1, startMinutes: 540, endMinutes: 1020 },
        ]}
      />,
    );
    expect(
      screen.getByText(/ראשון–שני 09:00–17:00/),
    ).toBeInTheDocument();
    // Those two days render as open with time selects.
    expect(screen.getAllByText(W.open).length).toBe(2);
  });

  it("toggling a closed day open reveals time selects defaulting to 09:00-17:00", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);

    // Sunday switch is the first switch.
    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);

    // Now one day is open.
    expect(screen.getAllByText(W.open).length).toBe(1);
    // Default start/end times appear in the time selects.
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("17:00")).toBeInTheDocument();
    // Unsaved-changes hint shows after a change.
    expect(screen.getByText(W.unsavedChanges)).toBeInTheDocument();
  });

  it("applying the 'sun-thru' preset opens five days", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);
    await user.click(screen.getByRole("button", { name: W.presets.sunThu9to17 }));
    expect(screen.getAllByText(W.open).length).toBe(5);
  });

  it("the 'with Friday' preset opens six days and 'clear all' closes them again", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);
    await user.click(screen.getByRole("button", { name: W.presets.withFriday }));
    expect(screen.getAllByText(W.open).length).toBe(6);

    await user.click(screen.getByRole("button", { name: W.presets.clearAll }));
    expect(screen.getAllByText(W.closed).length).toBe(7);
  });

  it("editing a time select marks the form dirty and submits the day fields", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);

    // Open Sunday.
    await user.click(screen.getAllByRole("switch")[0]);
    // Change the start time select.
    const startSelect = screen.getByLabelText(W.startTime);
    await user.selectOptions(startSelect, "10:00");
    expect(startSelect).toHaveValue("10:00");

    await user.click(screen.getByRole("button", { name: W.saveButton }));
    await waitFor(() => expect(m.saveWeeklyAvailabilityAction).toHaveBeenCalled());
    const fd = (m.saveWeeklyAvailabilityAction.mock.calls[0] as unknown[])[1] as FormData;
    expect(fd.get("day_0_open")).toBe("true");
    expect(fd.get("day_0_start")).toBe("10:00");
    expect(fd.get("day_1_open")).toBe("false");
  });

  it("renders per-day validation errors returned by the action (start and end)", async () => {
    m.nextState = {
      dayErrors: {
        0: { startTime: "יש לבחור שעת התחלה", endTime: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" },
      },
    };
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[{ weekday: 0, startMinutes: 540, endMinutes: 1020 }]} />);
    await user.click(screen.getByRole("button", { name: W.saveButton }));
    expect(await screen.findByText("יש לבחור שעת התחלה")).toBeInTheDocument();
    expect(
      screen.getByText("שעת הסיום חייבת להיות אחרי שעת ההתחלה"),
    ).toBeInTheDocument();
  });

  it("renders the form-level error from the action", async () => {
    m.nextState = { formError: AVAILABILITY.errors.generic };
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);
    await user.click(screen.getByRole("button", { name: W.saveButton }));
    expect(
      await screen.findByText(AVAILABILITY.errors.generic),
    ).toBeInTheDocument();
  });

  it("on success shows the success alert and clears the unsaved-changes hint", async () => {
    m.nextState = { success: true };
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);

    // Make a change so the dirty hint appears first.
    await user.click(screen.getAllByRole("switch")[0]);
    expect(screen.getByText(W.unsavedChanges)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: W.saveButton }));
    expect(await screen.findByText(W.success)).toBeInTheDocument();
    // Dirty flag reset on success.
    expect(screen.queryByText(W.unsavedChanges)).not.toBeInTheDocument();
  });

  it("clears the success state and shows an error on a subsequent failing submit", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityForm initialRules={[]} />);

    // First submit succeeds.
    m.nextState = { success: true };
    await user.click(screen.getByRole("button", { name: W.saveButton }));
    expect(await screen.findByText(W.success)).toBeInTheDocument();

    // Second submit fails -> success alert gone, error shown (prevSuccess reset path).
    m.nextState = { formError: AVAILABILITY.errors.generic };
    await user.click(screen.getByRole("button", { name: W.saveButton }));
    expect(
      await screen.findByText(AVAILABILITY.errors.generic),
    ).toBeInTheDocument();
    expect(screen.queryByText(W.success)).not.toBeInTheDocument();
  });
});
