// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualRunCard } from "@/components/automations/manual-run-card";
import type {
  EligibilityCheckResult,
  ManualRunResult,
  BlockedClientsByReason,
} from "@/server/win-back-automation/shared-types";

const m = vi.hoisted(() => ({
  check: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/server/win-back-automation/manual-run-action", () => ({
  checkWinBackEligibilityAction: m.check,
  runWinBackManualAction: m.run,
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

function emptyBlocked(): BlockedClientsByReason {
  return {
    invalidPhone: [],
    unsubscribed: [],
    noOptIn: [],
    noMarketingOptIn: [],
    hasFutureBooking: [],
    inCooldown: [],
    noCompletedBooking: [],
    counts: {
      total: 2,
      eligible: 2,
      invalidPhone: 0,
      unsubscribed: 0,
      noOptIn: 0,
      noMarketingOptIn: 0,
      hasFutureBooking: 0,
      inCooldown: 0,
      noCompletedBooking: 0,
    },
  };
}

function makeEligibility(over: Partial<EligibilityCheckResult> = {}): EligibilityCheckResult {
  return {
    success: true,
    automationEnabled: true,
    whatsappConnected: true,
    realSendConfigured: true,
    testModeActive: false,
    minuteModeActive: false,
    breakdown: {
      total: 2,
      eligible: 2,
      noCompletedBooking: 0,
      hasFutureBooking: 0,
      noOptIn: 0,
      invalidPhone: 0,
      inCooldown: 0,
      cooldownOverrideCount: 0,
    },
    eligibleClients: [
      { name: "רחל", maskedPhone: "***1234", lastService: "צביעה", daysSinceLastVisit: 40 },
      { name: "מירב", maskedPhone: "***5678", lastService: "תספורת", daysSinceLastVisit: 50 },
    ],
    blockedClients: emptyBlocked(),
    ...over,
  };
}

function makeRunResult(over: Partial<ManualRunResult> = {}): ManualRunResult {
  return {
    success: true,
    runId: "run-1",
    sentCount: 2,
    failedCount: 0,
    skippedCount: 0,
    mockSkipCount: 0,
    isMockMode: false,
    isTestMode: false,
    messages: [
      { clientId: "c1", clientName: "רחל", maskedPhone: "***1234", status: "sent", failureReason: null },
      { clientId: "c2", clientName: "מירב", maskedPhone: "***5678", status: "sent", failureReason: null },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.check.mockResolvedValue(makeEligibility());
  m.run.mockResolvedValue(makeRunResult());
});

describe("ManualRunCard — idle", () => {
  it("renders the header and an eligibility-check button", () => {
    render(<ManualRunCard />);
    expect(screen.getByText("בדיקת אוטומציה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /בדיקת זכאות/ })).toBeInTheDocument();
  });

  it("does not show admin test options for non-admins", () => {
    render(<ManualRunCard />);
    expect(screen.queryByText("אפשרויות בדיקה")).not.toBeInTheDocument();
  });

  it("shows admin test options with the ignore-cooldown checkbox for admins", () => {
    render(<ManualRunCard isAdmin />);
    expect(screen.getByText("אפשרויות בדיקה")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });
});

describe("ManualRunCard — check flow", () => {
  it("checks eligibility and shows the eligible client list", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));

    expect(await screen.findByText(/לקוחות זכאיות \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("רחל")).toBeInTheDocument();
    expect(screen.getByText("מירב")).toBeInTheDocument();
    expect(m.check).toHaveBeenCalled();
  });

  it("shows an error banner when the check fails", async () => {
    m.check.mockResolvedValueOnce({ success: false, error: "בדיקה נכשלה בשרת" });
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText("בדיקה נכשלה בשרת")).toBeInTheDocument();
  });

  it("shows the dev-mode banner when real send is not configured", async () => {
    m.check.mockResolvedValueOnce(makeEligibility({ realSendConfigured: false }));
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText(/WhatsApp Business לא מחובר/)).toBeInTheDocument();
  });

  it("shows the test-mode banner with masked phone", async () => {
    m.check.mockResolvedValueOnce(
      makeEligibility({ testModeActive: true, maskedTestPhone: "***9999" }),
    );
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText(/מצב בדיקה פעיל/)).toBeInTheDocument();
    expect(screen.getByText(/\*\*\*9999/)).toBeInTheDocument();
  });

  it("warns when the automation is disabled", async () => {
    m.check.mockResolvedValueOnce(makeEligibility({ automationEnabled: false }));
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText(/האוטומציה כבויה/)).toBeInTheDocument();
  });

  it("shows the no-eligible message when there are 0 eligible clients", async () => {
    m.check.mockResolvedValueOnce(
      makeEligibility({
        eligibleClients: [],
        breakdown: {
          total: 0,
          eligible: 0,
          noCompletedBooking: 0,
          hasFutureBooking: 0,
          noOptIn: 0,
          invalidPhone: 0,
          inCooldown: 0,
          cooldownOverrideCount: 0,
        },
        blockedClients: { ...emptyBlocked(), counts: { ...emptyBlocked().counts, total: 0, eligible: 0 } },
      }),
    );
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText("אין לקוחות זכאים לשליחה כרגע")).toBeInTheDocument();
  });

  it("shows the 'no settings' message when there is no breakdown", async () => {
    m.check.mockResolvedValueOnce(makeEligibility({ breakdown: null }));
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    expect(await screen.findByText(/לא נמצאו הגדרות אוטומציה/)).toBeInTheDocument();
  });
});

describe("ManualRunCard — confirm + run", () => {
  it("requires confirmation before sending, then runs and shows the summary", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));

    await user.click(await screen.findByRole("button", { name: /שליחה עכשיו/ }));
    // Confirmation panel.
    expect(screen.getByText(/הפעולה תשלח הודעות WhatsApp ל־2 לקוחות/)).toBeInTheDocument();
    expect(m.run).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /אישור — שלח עכשיו/ }));
    expect(m.run).toHaveBeenCalled();
    expect(await screen.findByText("סיכום הרצה:")).toBeInTheDocument();
    expect(screen.getByText(/כן — 2 הודעות/)).toBeInTheDocument();
  });

  it("can cancel the confirmation and return to the ready state", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await user.click(await screen.findByRole("button", { name: /שליחה עכשיו/ }));
    await user.click(screen.getByRole("button", { name: "ביטול" }));
    expect(screen.getByRole("button", { name: /שליחה עכשיו/ })).toBeInTheDocument();
    expect(m.run).not.toHaveBeenCalled();
  });

  it("shows the per-client result table and a 'new run' reset", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await user.click(await screen.findByRole("button", { name: /שליחה עכשיו/ }));
    await user.click(screen.getByRole("button", { name: /אישור — שלח עכשיו/ }));

    expect(await screen.findByText("טלפון לקוחה")).toBeInTheDocument();
    // status label "נשלח" appears for sent rows
    expect(screen.getAllByText("נשלח").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /הרצה חדשה/ }));
    expect(screen.getByRole("button", { name: /בדיקת זכאות/ })).toBeInTheDocument();
  });

  it("shows the run error when the run fails", async () => {
    m.run.mockResolvedValueOnce(makeRunResult({ success: false, error: "הרצה נכשלה" }));
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await user.click(await screen.findByRole("button", { name: /שליחה עכשיו/ }));
    await user.click(screen.getByRole("button", { name: /אישור — שלח עכשיו/ }));
    expect(await screen.findByText("הרצה נכשלה")).toBeInTheDocument();
  });

  it("shows a test-mode footnote and a 'sent to test phone' confirm message", async () => {
    m.check.mockResolvedValueOnce(
      makeEligibility({ testModeActive: true, maskedTestPhone: "***9999" }),
    );
    m.run.mockResolvedValueOnce(
      makeRunResult({ isTestMode: true, maskedTestPhone: "***9999", sentCount: 2 }),
    );
    const user = userEvent.setup();
    render(<ManualRunCard />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await user.click(await screen.findByRole("button", { name: /שליחה עכשיו/ }));
    expect(screen.getByText(/ההודעות יישלחו למספר הבדיקה/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /אישור — שלח עכשיו/ }));
    expect(await screen.findByText(/הועברו למספר הבדיקה/)).toBeInTheDocument();
  });
});

describe("ManualRunCard — admin cooldown override", () => {
  it("resets check results when the cooldown option changes mid-flow", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard isAdmin />);
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await screen.findByText(/לקוחות זכאיות/);

    await user.click(screen.getByRole("checkbox"));
    // Back to idle — the check button reappears.
    expect(screen.getByRole("button", { name: /בדיקת זכאות/ })).toBeInTheDocument();
  });

  it("passes ignoreCooldown to the check action for admins", async () => {
    const user = userEvent.setup();
    render(<ManualRunCard isAdmin />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות/ }));
    await waitFor(() => expect(m.check).toHaveBeenCalledWith({ ignoreCooldown: true }));
  });
});
