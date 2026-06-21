// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WinBackAutomationCard } from "@/components/automations/win-back-automation-card";
import type { AutomationSetting } from "@prisma/client";

const m = vi.hoisted(() => ({
  toggle: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/server/win-back-automation/actions", () => ({
  toggleWinBackAutomation: m.toggle,
}));

// Stub the settings form so we don't pull in its own server-action import.
vi.mock("@/components/win-back-automation/win-back-settings-form", async () => {
  const React = await import("react");
  return {
    WinBackSettingsForm: () =>
      React.createElement("div", { "data-testid": "win-back-settings-form" }, "settings-form"),
  };
});

function makeSetting(over: Partial<AutomationSetting> = {}): AutomationSetting {
  return {
    enabled: false,
    messageTemplate: null,
    offerType: "none",
    offerValue: "",
    templateName: null,
    templateStatus: null,
    ...over,
  } as unknown as AutomationSetting;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WinBackAutomationCard — card", () => {
  it("renders the title, off state and description", () => {
    render(<WinBackAutomationCard setting={makeSetting()} />);
    expect(screen.getByText("החזרת לקוחות")).toBeInTheDocument();
    expect(screen.getByText("כבוי")).toBeInTheDocument();
    expect(screen.getByText(/לקוחות שלא חזרו יקבלו הודעת WhatsApp/)).toBeInTheDocument();
  });

  it("shows the active state when the setting is enabled", () => {
    render(<WinBackAutomationCard setting={makeSetting({ enabled: true })} />);
    expect(screen.getByText("פעיל")).toBeInTheDocument();
  });

  it("toggles the automation on and calls the server action", async () => {
    const user = userEvent.setup();
    render(<WinBackAutomationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת החזרת לקוחות" }));
    expect(m.toggle).toHaveBeenCalledWith(true);
    expect(await screen.findByText("פעיל")).toBeInTheDocument();
  });

  it("reverts the optimistic toggle when the action fails", async () => {
    m.toggle.mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();
    render(<WinBackAutomationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת החזרת לקוחות" }));
    await waitFor(() => expect(screen.getByText("כבוי")).toBeInTheDocument());
  });
});

describe("WinBackAutomationCard — locked state", () => {
  it("shows the locked label and disables settings", () => {
    render(<WinBackAutomationCard setting={makeSetting()} locked />);
    expect(screen.getByText("זמין אחרי חיבור WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /הגדרות/ })).toBeDisabled();
  });

  it("shows a lock notice when the locked toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<WinBackAutomationCard setting={makeSetting()} locked />);
    await user.click(screen.getByRole("button", { name: "חברי WhatsApp כדי להפעיל" }));
    expect(screen.getByText("קודם צריך לחבר WhatsApp Business.")).toBeInTheDocument();
    expect(m.toggle).not.toHaveBeenCalled();
  });

  it("does not render the readiness badge when locked", () => {
    render(
      <WinBackAutomationCard
        setting={makeSetting({ templateName: "t", templateStatus: "approved" })}
        realSendConfigured
        locked
      />,
    );
    expect(screen.queryByText("מוכן לשליחה")).not.toBeInTheDocument();
  });

  it("renders the marketing readiness badge when unlocked + configured", () => {
    render(
      <WinBackAutomationCard
        setting={makeSetting({ templateName: "t", templateStatus: "pending" })}
        realSendConfigured
      />,
    );
    expect(screen.getByText("תבנית שיווקית ממתינה לאישור")).toBeInTheDocument();
  });
});

describe("WinBackAutomationCard — settings dialog", () => {
  it("opens the dialog with the embedded settings form and message preview", async () => {
    const user = userEvent.setup();
    render(<WinBackAutomationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: /הגדרות/ }));
    expect(screen.getByText("הגדרות החזרת לקוחות")).toBeInTheDocument();
    expect(screen.getAllByTestId("win-back-settings-form").length).toBeGreaterThan(0);
    // Preview substitutes the sample client name into the default template.
    expect(screen.getAllByText(/רחל כהן/).length).toBeGreaterThan(0);
  });

  it("closes the settings dialog via the X button", async () => {
    const user = userEvent.setup();
    render(<WinBackAutomationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: /הגדרות/ }));
    const heading = screen.getByText("הגדרות החזרת לקוחות");
    const closeBtn = within(heading.parentElement!).getByRole("button");
    await user.click(closeBtn);
    expect(screen.queryByText("הגדרות החזרת לקוחות")).not.toBeInTheDocument();
  });
});
