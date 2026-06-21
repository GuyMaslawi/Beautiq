// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type { AutomationSetting } from "@prisma/client";

const m = vi.hoisted(() => ({
  saveWinBackAutomationSetting: vi.fn(
    (): Promise<{ success: boolean; error?: string }> => Promise.resolve({ success: true }),
  ),
}));

vi.mock("@/server/win-back-automation/actions", () => ({
  saveWinBackAutomationSetting: m.saveWinBackAutomationSetting,
}));

import { WinBackSettingsForm } from "@/components/win-back-automation/win-back-settings-form";
import { DEFAULT_WIN_BACK_TEMPLATE } from "@/server/win-back-automation/message-builder";

function makeSetting(o: Partial<AutomationSetting> = {}): AutomationSetting {
  return {
    enabled: false,
    thresholdDays: 30,
    sendHour: 12,
    messageTemplate: null,
    offerType: "none",
    offerValue: "",
    cooldownDays: 30,
    requireOptIn: true,
    templateName: null,
    templateLanguage: "he",
    timingUnit: "days",
    testThresholdMinutes: null,
    testCooldownMinutes: null,
    ...o,
  } as unknown as AutomationSetting;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.saveWinBackAutomationSetting.mockResolvedValue({ success: true });
});

describe("WinBackSettingsForm — thresholds & offers", () => {
  it("renders the preset day chips and the custom option", () => {
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} />);
    expect(screen.getByText("מתי כדאי לנסות להחזיר לקוחה?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 ימים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "60 ימים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90 ימים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "מותאם אישית" })).toBeInTheDocument();
  });

  it("pre-selects 'custom' and pre-fills the input for a non-preset saved threshold", () => {
    render(<WinBackSettingsForm setting={makeSetting({ thresholdDays: 45 })} currentEnabled={false} />);
    expect((screen.getByPlaceholderText("לדוגמה: 45") as HTMLInputElement).value).toBe("45");
  });

  it("shows a validation error when custom days is empty on save and does not call the action", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} />);
    await user.click(screen.getByRole("button", { name: "מותאם אישית" }));
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    expect(await screen.findByText("יש להזין מספר ימים תקין")).toBeInTheDocument();
    expect(m.saveWinBackAutomationSetting).not.toHaveBeenCalled();
  });

  it("saves a preset threshold and reports success", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled />);
    await user.click(screen.getByRole("button", { name: "60 ימים" }));
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    await waitFor(() =>
      expect(m.saveWinBackAutomationSetting).toHaveBeenCalledWith(
        expect.objectContaining({ thresholdDays: 60, enabled: true, timingUnit: "days" }),
      ),
    );
    expect(await screen.findByText("ההגדרות נשמרו")).toBeInTheDocument();
  });

  it("shows a custom offer input when 'הטבה אישית' is selected and passes offerValue on save", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} />);
    await user.click(screen.getByRole("button", { name: "הטבה אישית" }));
    const offerInput = screen.getByPlaceholderText(/מגיעה לך הנחה של 15%/);
    await user.type(offerInput, "קפה מתנה");
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    await waitFor(() =>
      expect(m.saveWinBackAutomationSetting).toHaveBeenCalledWith(
        expect.objectContaining({ offerType: "custom", offerValue: "קפה מתנה" }),
      ),
    );
  });

  it("surfaces the action error when saving fails", async () => {
    m.saveWinBackAutomationSetting.mockResolvedValue({ success: false, error: "שמירה נכשלה. יש לנסות שוב." });
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} />);
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    expect(await screen.findByText("שמירה נכשלה. יש לנסות שוב.")).toBeInTheDocument();
  });

  it("fires onPreviewChange when offer type changes", async () => {
    const onPreviewChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WinBackSettingsForm setting={makeSetting()} currentEnabled={false} onPreviewChange={onPreviewChange} />,
    );
    await user.click(screen.getByRole("button", { name: "10% הנחה" }));
    expect(onPreviewChange).toHaveBeenCalled();
  });
});

describe("WinBackSettingsForm — advanced editor", () => {
  it("reveals the send-time chips and message template, and resets the template", async () => {
    const onPreviewChange = vi.fn();
    const user = userEvent.setup();
    render(
      <WinBackSettingsForm
        setting={makeSetting({ messageTemplate: "טקסט מותאם" })}
        currentEnabled={false}
        onPreviewChange={onPreviewChange}
      />,
    );
    await user.click(screen.getByText("עריכה מתקדמת"));
    expect(screen.getByText("מתי לשלוח?")).toBeInTheDocument();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("טקסט מותאם");
    // reset
    await user.click(screen.getByRole("button", { name: "איפוס" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(DEFAULT_WIN_BACK_TEMPLATE);
    expect(onPreviewChange).toHaveBeenCalled();
  });

  it("changing the send hour is reflected on save", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} />);
    await user.click(screen.getByText("עריכה מתקדמת"));
    await user.click(screen.getByRole("button", { name: "18:00 — ערב" }));
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    await waitFor(() =>
      expect(m.saveWinBackAutomationSetting).toHaveBeenCalledWith(expect.objectContaining({ sendHour: 18 })),
    );
  });
});

describe("WinBackSettingsForm — test mode (minutes)", () => {
  it("hides the test-mode block entirely for regular owners", () => {
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} allowMinuteTesting={false} />);
    expect(screen.queryByText("מצב בדיקה")).not.toBeInTheDocument();
  });

  it("shows the test-mode block for admins and toggles to minutes mode", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} allowMinuteTesting />);
    expect(screen.getByText("מצב בדיקה")).toBeInTheDocument();
    // days mode info shown by default
    expect(screen.getByText(/שליחה אחרי/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "דקות לבדיקה" }));
    expect(screen.getByText(/מצב בדיקה פעיל — האוטומציה מחשבת זכאות לפי דקות/)).toBeInTheDocument();
  });

  it("validates minute inputs and blocks save with an invalid value", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} allowMinuteTesting />);
    await user.click(screen.getByRole("button", { name: "דקות לבדיקה" }));
    const thresholdInput = screen.getAllByRole("spinbutton")[0];
    await user.clear(thresholdInput);
    await user.type(thresholdInput, "0");
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    expect(await screen.findByText("יש להזין מספר דקות תקין (לפחות 1).")).toBeInTheDocument();
    expect(m.saveWinBackAutomationSetting).not.toHaveBeenCalled();
  });

  it("requires the confirmation checkbox when real sends are configured in minutes mode", async () => {
    const user = userEvent.setup();
    render(
      <WinBackSettingsForm
        setting={makeSetting()}
        currentEnabled={false}
        allowMinuteTesting
        realSendConfigured
      />,
    );
    await user.click(screen.getByRole("button", { name: "דקות לבדיקה" }));
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    expect(
      await screen.findByText("יש לאשר את ההבנה לפני שמירה במצב דקות עם שליחה אמיתית."),
    ).toBeInTheDocument();
    expect(m.saveWinBackAutomationSetting).not.toHaveBeenCalled();

    // Tick the confirmation and save succeeds with minutes timing.
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    await waitFor(() =>
      expect(m.saveWinBackAutomationSetting).toHaveBeenCalledWith(
        expect.objectContaining({ timingUnit: "minutes", testThresholdMinutes: 5, testCooldownMinutes: 1 }),
      ),
    );
  });

  it("saves in minutes mode without confirmation when real sends are NOT configured", async () => {
    const user = userEvent.setup();
    render(<WinBackSettingsForm setting={makeSetting()} currentEnabled={false} allowMinuteTesting realSendConfigured={false} />);
    await user.click(screen.getByRole("button", { name: "דקות לבדיקה" }));
    // No confirmation checkbox is shown
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "שמירת הגדרות" }));
    await waitFor(() =>
      expect(m.saveWinBackAutomationSetting).toHaveBeenCalledWith(
        expect.objectContaining({ timingUnit: "minutes" }),
      ),
    );
  });
});
