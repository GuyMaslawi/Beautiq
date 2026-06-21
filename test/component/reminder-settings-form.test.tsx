// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReminderSettingsForm } from "@/components/automations/reminder-settings-form";
import { AUTOMATIONS } from "@/lib/constants/he";
import type { ReminderSettings } from "@/server/automations/queries";

const m = vi.hoisted(() => ({
  state: { success: undefined as string | undefined, error: undefined as string | undefined },
}));

// Stub React.useActionState so we control state + don't need a real server action.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () =>
      [m.state, (() => {}) as unknown, false] as const,
  };
});

vi.mock("@/server/automations/actions", () => ({
  saveReminderSettingsAction: vi.fn(),
}));

const c = AUTOMATIONS.reminders.settings;

function makeSettings(over: Partial<ReminderSettings> = {}): ReminderSettings {
  return {
    reminderHoursBefore: 24,
    reminderTemplate: "היי {שם}, יש לך תור",
    ...over,
  } as ReminderSettings;
}

beforeEach(() => {
  m.state.success = undefined;
  m.state.error = undefined;
});

describe("ReminderSettingsForm", () => {
  it("renders the timing presets and template label", () => {
    render(<ReminderSettingsForm settings={makeSettings()} />);
    expect(screen.getByText(c.timingLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.timing24 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.timing12 })).toBeInTheDocument();
    expect(screen.getByText(c.templateLabel)).toBeInTheDocument();
  });

  it("seeds the hidden hours input with the current preset value", () => {
    const { container } = render(<ReminderSettingsForm settings={makeSettings({ reminderHoursBefore: 12 })} />);
    const hidden = container.querySelector('input[name="reminderHoursBefore"]') as HTMLInputElement;
    expect(hidden.value).toBe("12");
  });

  it("updates the hidden hours field when a preset is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<ReminderSettingsForm settings={makeSettings()} />);
    await user.click(screen.getByRole("button", { name: c.timing3 }));
    const hidden = container.querySelector('input[name="reminderHoursBefore"]') as HTMLInputElement;
    expect(hidden.value).toBe("3");
  });

  it("starts in custom mode for a non-preset hour value and lets you edit it", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(<ReminderSettingsForm settings={makeSettings({ reminderHoursBefore: 6 })} />);
    // Custom input visible because 6 is not a preset.
    const num = screen.getByPlaceholderText(c.customHoursPlaceholder) as HTMLInputElement;
    expect(num.value).toBe("6");
    fireEvent.change(num, { target: { value: "8" } });
    expect(num.value).toBe("8");
    // Non-numeric input is ignored by the onChange guard.
    fireEvent.change(num, { target: { value: "" } });
    expect(num.value).toBe("8");
  });

  it("reveals the custom hours input when 'זמן מותאם אישית' is clicked", async () => {
    const user = userEvent.setup();
    render(<ReminderSettingsForm settings={makeSettings()} />);
    expect(screen.queryByText(c.customHoursLabel)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: c.timingCustom }));
    expect(screen.getByText(c.customHoursLabel)).toBeInTheDocument();
  });

  it("inserts a variable chip into the template textarea at the caret", async () => {
    const user = userEvent.setup();
    render(<ReminderSettingsForm settings={makeSettings({ reminderTemplate: "" })} />);
    const chip = AUTOMATIONS.reminders.settings.variableChips[0];
    await user.click(screen.getByRole("button", { name: chip }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain(chip);
  });

  it("edits the template text directly", async () => {
    const user = userEvent.setup();
    render(<ReminderSettingsForm settings={makeSettings({ reminderTemplate: "" })} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "שלום");
    expect((textarea as HTMLTextAreaElement).value).toBe("שלום");
  });

  it("shows the success message from action state", () => {
    m.state.success = c.saved;
    render(<ReminderSettingsForm settings={makeSettings()} />);
    expect(screen.getByText(c.saved)).toBeInTheDocument();
  });

  it("shows the error message from action state", () => {
    m.state.error = "שגיאה בשמירה";
    render(<ReminderSettingsForm settings={makeSettings()} />);
    expect(screen.getByText("שגיאה בשמירה")).toBeInTheDocument();
  });

  it("renders the save button", () => {
    render(<ReminderSettingsForm settings={makeSettings()} />);
    expect(screen.getByRole("button", { name: c.saveButton })).toBeInTheDocument();
  });
});
