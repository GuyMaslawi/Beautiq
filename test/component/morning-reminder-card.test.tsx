// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MorningReminderCard } from "@/components/automations/morning-reminder-card";
import type { AutomationSetting } from "@prisma/client";

const m = vi.hoisted(() => ({
  toggle: vi.fn(() => Promise.resolve({ success: true })),
  saveTiming: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/server/morning-reminder/actions", () => ({
  toggleMorningReminderAction: m.toggle,
  saveMorningReminderTimingAction: m.saveTiming,
}));

function makeSetting(over: Partial<AutomationSetting> = {}): AutomationSetting {
  return {
    enabled: false,
    sendHour: 8,
    thresholdDays: 0,
    messageTemplate: null,
    requireOptIn: false,
    templateName: null,
    templateLanguage: "he",
    templateStatus: null,
    ...over,
  } as unknown as AutomationSetting;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MorningReminderCard — card", () => {
  it("renders the title, off state and sent-this-month note", () => {
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={7} />);
    expect(screen.getByText("תזכורת לפני תור")).toBeInTheDocument();
    expect(screen.getByText("כבוי")).toBeInTheDocument();
    expect(screen.getByText("נשלחו 7 תזכורות החודש")).toBeInTheDocument();
  });

  it("shows the active state when enabled", () => {
    render(<MorningReminderCard setting={makeSetting({ enabled: true })} sentThisMonth={0} />);
    expect(screen.getByText("פעיל")).toBeInTheDocument();
  });

  it("toggles the reminder and calls the action", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת תזכורת לפני תור" }));
    expect(m.toggle).toHaveBeenCalledWith(true);
    expect(await screen.findByText("פעיל")).toBeInTheDocument();
  });

  it("reverts the toggle when the action fails", async () => {
    m.toggle.mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת תזכורת לפני תור" }));
    await waitFor(() => expect(screen.getByText("כבוי")).toBeInTheDocument());
  });
});

describe("MorningReminderCard — locked state", () => {
  it("shows the locked label and disables settings", () => {
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={5} locked />);
    expect(screen.getByText("זמין אחרי חיבור WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הגדרה" })).toBeDisabled();
    // sent-this-month note hidden while locked
    expect(screen.queryByText(/נשלחו 5 תזכורות/)).not.toBeInTheDocument();
  });

  it("shows a lock notice when the locked toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} locked />);
    await user.click(screen.getByRole("button", { name: "חברי WhatsApp כדי להפעיל" }));
    expect(screen.getByText("קודם צריך לחבר WhatsApp Business.")).toBeInTheDocument();
  });
});

describe("MorningReminderCard — timing detection", () => {
  it("detects evening-before timing from the setting", async () => {
    const user = userEvent.setup();
    render(
      <MorningReminderCard setting={makeSetting({ sendHour: 20, thresholdDays: 1 })} sentThisMonth={0} />,
    );
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    // Selected option is reflected by the timing dialog showing.
    expect(screen.getByText("🌙 ערב לפני התור")).toBeInTheDocument();
  });

  it("detects three-hours-before timing from a negative sendHour", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting({ sendHour: -3 })} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText("⏰ כמה שעות לפני התור")).toBeInTheDocument();
  });
});

describe("MorningReminderCard — settings dialog", () => {
  it("opens the dialog and shows timing options and a preview", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText("מתי לשלוח?")).toBeInTheDocument();
    expect(screen.getByText("☀️ בוקר התור")).toBeInTheDocument();
    // Preview substitutes the sample name.
    expect(screen.getAllByText(/נועה/).length).toBeGreaterThan(0);
  });

  it("selects a different timing option", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByText("🌙 ערב לפני התור"));
    // Save uses the selected timing.
    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    await waitFor(() =>
      expect(m.saveTiming).toHaveBeenCalledWith(
        expect.objectContaining({ sendHour: 20, thresholdDays: 1 }),
      ),
    );
  });

  it("expands the advanced section and edits the message template", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByRole("button", { name: /עריכה מתקדמת/ }));
    expect(screen.getByPlaceholderText("morning_reminder_he")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "דרישת אישור WhatsApp" }));
    expect(screen.getByText(/יישלחו רק ללקוחות שנתנו הסכמה/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /עריכת נוסח ההודעה/ }));
    expect(screen.getByText("נוסח ההודעה")).toBeInTheDocument();
  });

  it("saves the timing and template fields", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByRole("button", { name: /עריכה מתקדמת/ }));
    await user.type(screen.getByPlaceholderText("morning_reminder_he"), "  tpl  ");
    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    await waitFor(() =>
      expect(m.saveTiming).toHaveBeenCalledWith(
        expect.objectContaining({ templateName: "tpl", templateLanguage: "he" }),
      ),
    );
    expect(await screen.findAllByText("נשמר ✓")).toBeTruthy();
  });

  it("shows the save error message when the action fails", async () => {
    m.saveTiming.mockResolvedValueOnce({ error: "שמירה נכשלה" });
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });

  it("closes the dialog via the X button", async () => {
    const user = userEvent.setup();
    render(<MorningReminderCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    const heading = screen.getByText("תזכורת לפני תור", { selector: "h2" });
    const closeBtn = within(heading.parentElement!).getByRole("button");
    await user.click(closeBtn);
    expect(screen.queryByText("מתי לשלוח?")).not.toBeInTheDocument();
  });
});
