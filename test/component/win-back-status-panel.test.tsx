// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type {
  AutomationSetting,
  WhatsAppConnection,
  AutomationRun,
} from "@prisma/client";
import type { WinBackStats, EligibilityBreakdown } from "@/server/win-back-automation/queries";

const m = vi.hoisted(() => ({
  toggleWinBackAutomation: vi.fn(() => Promise.resolve({ success: true })),
  triggerWinBackRun: vi.fn(),
  sendWhatsAppTestMessage: vi.fn(),
}));

vi.mock("@/server/win-back-automation/actions", () => ({
  toggleWinBackAutomation: m.toggleWinBackAutomation,
  triggerWinBackRun: m.triggerWinBackRun,
  sendWhatsAppTestMessage: m.sendWhatsAppTestMessage,
}));

import { WinBackStatusPanel } from "@/components/win-back-automation/win-back-status-panel";

function makeStats(o: Partial<WinBackStats> = {}): WinBackStats {
  return {
    realSentThisMonth: 0,
    mockRunsThisMonth: 0,
    failedThisMonth: 0,
    skippedThisMonth: 0,
    sentThisMonth: 0,
    ...o,
  };
}

function makeBreakdown(o: Partial<EligibilityBreakdown> = {}): EligibilityBreakdown {
  return {
    total: 10,
    eligible: 3,
    noCompletedBooking: 2,
    hasFutureBooking: 1,
    noOptIn: 2,
    noMarketingOptIn: 1,
    invalidPhone: 1,
    inCooldown: 1,
    cooldownOverrideCount: 0,
    ...o,
  };
}

type PanelProps = React.ComponentProps<typeof WinBackStatusPanel>;

function baseProps(o: Partial<PanelProps> = {}): PanelProps {
  return {
    setting: { enabled: false, templateName: null, templateLanguage: "he", requireOptIn: true } as unknown as AutomationSetting,
    connection: null,
    lastRun: null,
    stats: makeStats(),
    eligibleCount: 5,
    breakdown: makeBreakdown(),
    realSendEnabled: false,
    credentialsConfigured: false,
    testModeActive: false,
    testPhoneConfigured: false,
    sandboxTestPassed: false,
    hasRealBusinessPhone: false,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.triggerWinBackRun.mockResolvedValue({
    success: true,
    sentCount: 2,
    skippedCount: 1,
    failedCount: 0,
    mockSkipCount: 0,
  });
  m.sendWhatsAppTestMessage.mockResolvedValue({ success: true, providerMessageId: "wamid.123" });
});

describe("WinBackStatusPanel — hero & enable", () => {
  it("renders the hero, KPI count and the enable CTA when disabled", () => {
    render(<WinBackStatusPanel {...baseProps({ eligibleCount: 7 })} />);
    expect(screen.getByText("החזרת לקוחות אוטומטית")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("לקוחות להחזרה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /הפעלת החזרת לקוחות/ })).toBeInTheDocument();
  });

  it("enabling calls toggleWinBackAutomation(true)", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: false } as AutomationSetting })} />);
    await user.click(screen.getByRole("button", { name: /הפעלת החזרת לקוחות/ }));
    await waitFor(() => expect(m.toggleWinBackAutomation).toHaveBeenCalledWith(true));
  });

  it("shows the active state with a 'כיבוי' control that calls toggle(false)", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    expect(screen.getByText("החזרת לקוחות פעילה")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /כיבוי/ }));
    await waitFor(() => expect(m.toggleWinBackAutomation).toHaveBeenCalledWith(false));
  });
});

describe("WinBackStatusPanel — advanced section", () => {
  async function openAdvanced(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
  }

  it("toggles the advanced panel open and closed", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps()} />);
    expect(screen.queryByText("חיבור WhatsApp")).not.toBeInTheDocument();
    await openAdvanced(user);
    expect(screen.getByText("חיבור WhatsApp")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    await waitFor(() => expect(screen.queryByText("חיבור WhatsApp")).not.toBeInTheDocument());
  });

  it("shows the 'ready' readiness when not in real-send mode and disabled", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ realSendEnabled: false })} />);
    await openAdvanced(user);
    expect(screen.getByText("המערכת מוכנה לשליחה")).toBeInTheDocument();
  });

  it("shows 'active' readiness when enabled (dev mode)", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    await openAdvanced(user);
    expect(screen.getByText("השליחה האוטומטית פעילה")).toBeInTheDocument();
  });

  it("warns 'נדרש חיבור WhatsApp' when real send is on but credentials are missing", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ realSendEnabled: true, credentialsConfigured: false })} />);
    await openAdvanced(user);
    expect(screen.getByText("נדרש חיבור WhatsApp")).toBeInTheDocument();
  });

  it("warns 'נדרשת תבנית הודעה מאושרת' when credentials exist but no approved template", async () => {
    const user = userEvent.setup();
    render(
      <WinBackStatusPanel
        {...baseProps({
          realSendEnabled: true,
          credentialsConfigured: true,
          setting: { enabled: false, templateName: null } as AutomationSetting,
        })}
      />,
    );
    await openAdvanced(user);
    expect(screen.getByText("נדרשת תבנית הודעה מאושרת")).toBeInTheDocument();
  });

  it("renders provider/real-send/test-mode connection details and the configured phone", async () => {
    const user = userEvent.setup();
    render(
      <WinBackStatusPanel
        {...baseProps({
          realSendEnabled: true,
          credentialsConfigured: true,
          testModeActive: true,
          connection: { provider: "meta_cloud_api", phoneNumber: "+972501112233" } as unknown as WhatsAppConnection,
          setting: { enabled: true, templateName: "win_back_v1", templateLanguage: "he" } as AutomationSetting,
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.getByText("meta_cloud_api")).toBeInTheDocument();
    expect(screen.getByText("מופעלת")).toBeInTheDocument();
    expect(screen.getByText("פעיל")).toBeInTheDocument();
    expect(screen.getByText("מוגדרים")).toBeInTheDocument();
    expect(screen.getByText("+972501112233")).toBeInTheDocument();
    // template block
    expect(screen.getByText("win_back_v1")).toBeInTheDocument();
  });

  it("renders the eligibility breakdown with skip reasons", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ breakdown: makeBreakdown({ inCooldown: 3 }) })} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.getByText("פירוט בדיקת לקוחות")).toBeInTheDocument();
    expect(screen.getByText("לקוחות שנבדקו")).toBeInTheDocument();
    expect(screen.getByText("מתאימות לשליחה")).toBeInTheDocument();
    // a skip reason with count > 0
    expect(screen.getByText("· כבר קיבלו הודעה לאחרונה")).toBeInTheDocument();
  });

  it("shows the mock-runs warning when there were dev test runs this month", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ stats: makeStats({ mockRunsThisMonth: 4 }) })} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.getByText(/4 הרצות בדיקה החודש/)).toBeInTheDocument();
  });

  it("shows the zero-eligible opt-in note when enabled with no eligible clients", async () => {
    const user = userEvent.setup();
    render(
      <WinBackStatusPanel
        {...baseProps({
          setting: { enabled: true, requireOptIn: true } as AutomationSetting,
          eligibleCount: 0,
          breakdown: makeBreakdown({ noOptIn: 3 }),
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.getByText(/אין לקוחות שמחכות להודעה כרגע/)).toBeInTheDocument();
    expect(screen.getByText(/ניתן להוסיף אישור קבלת הודעות/)).toBeInTheDocument();
  });

  it("renders last-run details (sent / skipped / failed)", async () => {
    const user = userEvent.setup();
    render(
      <WinBackStatusPanel
        {...baseProps({
          lastRun: { startedAt: new Date("2026-06-10T09:30:00"), sentCount: 5, skippedCount: 2, failedCount: 1 } as AutomationRun,
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.getByText(/5 נשלחו/)).toBeInTheDocument();
    expect(screen.getByText(/2 דולגו/)).toBeInTheDocument();
    expect(screen.getByText(/1 נכשלו/)).toBeInTheDocument();
  });
});

describe("WinBackStatusPanel — manual run", () => {
  async function openAdvancedEnabled(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
  }

  it("asks for confirmation, then runs and shows the success summary", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    await openAdvancedEnabled(user);

    await user.click(screen.getByRole("button", { name: /הפעלה ידנית עכשיו/ }));
    expect(screen.getByText("אישור הרצת בדיקה")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^אישור$/ }));

    await waitFor(() => expect(m.triggerWinBackRun).toHaveBeenCalled());
    expect(await screen.findByText(/2 נשלחו, 1 דולגו/)).toBeInTheDocument();
  });

  it("cancelling the run confirmation does not call triggerWinBackRun", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    await openAdvancedEnabled(user);
    await user.click(screen.getByRole("button", { name: /הפעלה ידנית עכשיו/ }));
    await user.click(screen.getByRole("button", { name: /ביטול/ }));
    expect(screen.queryByText("אישור הרצת בדיקה")).not.toBeInTheDocument();
    expect(m.triggerWinBackRun).not.toHaveBeenCalled();
  });

  it("a mock-only run reports the test-run message", async () => {
    m.triggerWinBackRun.mockResolvedValue({
      success: true,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      mockSkipCount: 3,
    });
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    await openAdvancedEnabled(user);
    await user.click(screen.getByRole("button", { name: /הפעלה ידנית עכשיו/ }));
    await user.click(screen.getByRole("button", { name: /^אישור$/ }));
    expect(await screen.findByText(/3 הרצות בדיקה \(לא נשלח בפועל\)/)).toBeInTheDocument();
  });

  it("a failed run shows the error message", async () => {
    m.triggerWinBackRun.mockResolvedValue({
      success: false,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      mockSkipCount: 0,
      error: "הרצת האוטומציה נכשלה. יש לנסות שוב.",
    });
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: true } as AutomationSetting })} />);
    await openAdvancedEnabled(user);
    await user.click(screen.getByRole("button", { name: /הפעלה ידנית עכשיו/ }));
    await user.click(screen.getByRole("button", { name: /^אישור$/ }));
    expect(await screen.findByText(/הרצת האוטומציה נכשלה/)).toBeInTheDocument();
  });

  it("does not show the manual run controls while disabled", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ setting: { enabled: false } as AutomationSetting })} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.queryByRole("button", { name: /הפעלה ידנית עכשיו/ })).not.toBeInTheDocument();
  });
});

describe("WinBackStatusPanel — test send", () => {
  const canTestProps = () =>
    baseProps({
      setting: { enabled: true } as AutomationSetting,
      realSendEnabled: true,
      credentialsConfigured: true,
      testModeActive: true,
      testPhoneConfigured: true,
    });

  it("shows the test-send button only when all test conditions are met, and sends", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...canTestProps()} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    const btn = screen.getByRole("button", { name: /שליחת בדיקה למספר שלי/ });
    await user.click(btn);
    await waitFor(() => expect(m.sendWhatsAppTestMessage).toHaveBeenCalled());
    expect(await screen.findByText(/הודעת בדיקה נשלחה/)).toBeInTheDocument();
    expect(screen.getByText(/wamid\.123/)).toBeInTheDocument();
  });

  it("a failed test send shows the error", async () => {
    m.sendWhatsAppTestMessage.mockResolvedValue({ success: false, error: "שגיאה בשליחה" });
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...canTestProps()} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    await user.click(screen.getByRole("button", { name: /שליחת בדיקה למספר שלי/ }));
    expect(await screen.findByText(/שגיאה בשליחה/)).toBeInTheDocument();
  });

  it("hides the test-send button when test mode is off", async () => {
    const user = userEvent.setup();
    render(<WinBackStatusPanel {...baseProps({ realSendEnabled: true, credentialsConfigured: true, testModeActive: false, testPhoneConfigured: true })} />);
    await user.click(screen.getByRole("button", { name: /הגדרות מתקדמות/ }));
    expect(screen.queryByRole("button", { name: /שליחת בדיקה למספר שלי/ })).not.toBeInTheDocument();
  });
});
