// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  WhatsAppDiagnosticsPanel,
  type DiagnosticsClientOption,
} from "@/components/whatsapp/whatsapp-diagnostics-panel";
import type {
  WhatsAppSendEvaluation,
  DiagnosticCheck,
} from "@/server/whatsapp/diagnostics";
import type { TestSendActionResult } from "@/server/whatsapp/diagnostics-actions";

/**
 * Admin-only WhatsApp diagnostics panel.
 *   - dry-run: pure eligibility check, never sends; renders pass/block + checks.
 *   - test-send: a single guarded test send; renders sent/failed status.
 * Every action is mocked so NO real send ever happens.
 */

const m = vi.hoisted(() => ({
  runWhatsAppDryRunAction: vi.fn(),
  runWhatsAppTestSendAction: vi.fn(),
}));

vi.mock("@/server/whatsapp/diagnostics-actions", () => ({
  runWhatsAppDryRunAction: m.runWhatsAppDryRunAction,
  runWhatsAppTestSendAction: m.runWhatsAppTestSendAction,
}));

const CLIENTS: DiagnosticsClientOption[] = [
  { id: "c1", label: "דנה · •••• 1234" },
  { id: "c2", label: "מיכל · •••• 5678" },
];

function check(over: Partial<DiagnosticCheck> & { key: string; label: string; ok: boolean }): DiagnosticCheck {
  return over;
}

function evaluation(over: Partial<WhatsAppSendEvaluation> = {}): WhatsAppSendEvaluation {
  return {
    messageType: "booking_confirmation",
    messageTypeLabel: "אישור תור",
    wouldSend: true,
    checks: [
      check({ key: "real_send", label: "שליחה אמיתית מופעלת", ok: true }),
      check({ key: "connection", label: "חיבור WhatsApp פעיל וספק שליחה תקין", ok: true, detail: "מחובר" }),
    ],
    context: {
      realSendEnabled: true,
      testMode: false,
      providerName: "meta_cloud_api",
      connectionStatusLabel: "מחובר",
      clientSelected: false,
    },
    ...over,
  };
}

function testSendResult(over: Partial<TestSendActionResult> = {}): TestSendActionResult {
  return {
    ok: true,
    sent: true,
    status: "sent",
    message: "הודעת בדיקה נשלחה למספר הבדיקה. בדקי את המכשיר שמחובר למספר הבדיקה.",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.runWhatsAppDryRunAction.mockResolvedValue({ ok: true, evaluation: evaluation() });
  m.runWhatsAppTestSendAction.mockResolvedValue(testSendResult());
});

describe("WhatsAppDiagnosticsPanel — render", () => {
  it("renders the admin header copy and badge", () => {
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);
    expect(screen.getByText("בדיקת שליחת WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(
      screen.getByText("בודק בדיוק מדוע הודעה תישלח או תיחסם — ללא שליחה בפועל."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/שליחת הבדיקה נשלחת אך ורק למספר הבדיקה המוגדר/),
    ).toBeInTheDocument();
  });

  it("renders all message-type options and client options", () => {
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);
    for (const label of ["אישור תור", "תזכורת לפני תור", "בקשת ביקורת", "החזרת לקוחות", "הודעת בדיקה"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("option", { name: "— ללא לקוחה (בדיקת מערכת) —" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "דנה · •••• 1234" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "מיכל · •••• 5678" })).toBeInTheDocument();
  });

  it("renders both action buttons in their idle state", () => {
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);
    expect(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /שליחת הודעת בדיקה/ })).toBeInTheDocument();
  });

  it("enables the client select for non-manual types and disables it for manual", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);
    const clientSelect = screen.getByRole("combobox", { name: /לקוחה/ });
    expect(clientSelect).not.toBeDisabled();

    const typeSelect = screen.getByRole("combobox", { name: /סוג הודעה/ });
    await user.selectOptions(typeSelect, "manual");
    expect(clientSelect).toBeDisabled();
  });
});

describe("WhatsAppDiagnosticsPanel — dry run", () => {
  it("calls the dry-run action with the selected type and client", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /סוג הודעה/ }), "win_back");
    await user.selectOptions(screen.getByRole("combobox", { name: /לקוחה/ }), "c2");
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(m.runWhatsAppDryRunAction).toHaveBeenCalled());
    expect(m.runWhatsAppDryRunAction).toHaveBeenCalledWith({
      messageType: "win_back",
      clientId: "c2",
    });
  });

  it("omits the client id for the manual message type", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /סוג הודעה/ }), "manual");
    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(m.runWhatsAppDryRunAction).toHaveBeenCalled());
    expect(m.runWhatsAppDryRunAction).toHaveBeenCalledWith({
      messageType: "manual",
      clientId: undefined,
    });
  });

  it("passes clientId undefined when no client is selected", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(m.runWhatsAppDryRunAction).toHaveBeenCalled());
    expect(m.runWhatsAppDryRunAction).toHaveBeenCalledWith({
      messageType: "booking_confirmation",
      clientId: undefined,
    });
  });

  it("renders a success evaluation with the would-send message and checks", async () => {
    const user = userEvent.setup();
    m.runWhatsAppDryRunAction.mockResolvedValue({
      ok: true,
      evaluation: evaluation({
        wouldSend: true,
        checks: [
          check({ key: "real_send", label: "שליחה אמיתית מופעלת", ok: true }),
          check({ key: "connection", label: "חיבור פעיל", ok: true, detail: "מחובר" }),
        ],
      }),
    });
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(screen.getByText("ההודעה (אישור תור) תישלח")).toBeInTheDocument());
    expect(screen.getByText("שליחה אמיתית מופעלת")).toBeInTheDocument();
    expect(screen.getByText("חיבור פעיל")).toBeInTheDocument();
    expect(screen.getByText("מחובר")).toBeInTheDocument();
  });

  it("renders a blocked evaluation with the block reason code", async () => {
    const user = userEvent.setup();
    m.runWhatsAppDryRunAction.mockResolvedValue({
      ok: true,
      evaluation: evaluation({
        wouldSend: false,
        blockReason: { code: "missing_connection", label: "אין חיבור WhatsApp פעיל" },
        checks: [
          check({ key: "real_send", label: "שליחה אמיתית מופעלת", ok: true }),
          check({ key: "connection", label: "חיבור WhatsApp פעיל", ok: false }),
        ],
      }),
    });
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(screen.getByText("ההודעה (אישור תור) לא תישלח")).toBeInTheDocument());
    expect(screen.getByText(/סיבה: אין חיבור WhatsApp פעיל/)).toBeInTheDocument();
    expect(screen.getByText("(missing_connection)")).toBeInTheDocument();
  });

  it("renders an error banner when the dry-run action returns ok:false", async () => {
    const user = userEvent.setup();
    m.runWhatsAppDryRunAction.mockResolvedValue({
      ok: false,
      error: "פעולה זו זמינה למנהלי מערכת בלבד.",
    });
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() =>
      expect(screen.getByText("פעולה זו זמינה למנהלי מערכת בלבד.")).toBeInTheDocument(),
    );
  });

  it("falls back to a generic error when ok:false carries no message", async () => {
    const user = userEvent.setup();
    m.runWhatsAppDryRunAction.mockResolvedValue({ ok: false });
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));

    await waitFor(() => expect(screen.getByText("אירעה שגיאה.")).toBeInTheDocument());
  });

  it("clears a prior evaluation when changing the message type", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));
    await waitFor(() => expect(screen.getByText("ההודעה (אישור תור) תישלח")).toBeInTheDocument());

    await user.selectOptions(screen.getByRole("combobox", { name: /סוג הודעה/ }), "review_request");
    expect(screen.queryByText("ההודעה (אישור תור) תישלח")).not.toBeInTheDocument();
  });

  it("handles an ok:true response with no evaluation gracefully", async () => {
    const user = userEvent.setup();
    m.runWhatsAppDryRunAction.mockResolvedValue({ ok: true });
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /בדיקת זכאות לשליחה/ }));
    await waitFor(() => expect(m.runWhatsAppDryRunAction).toHaveBeenCalled());
    expect(screen.queryByText(/ההודעה \(.*\) תישלח/)).not.toBeInTheDocument();
  });
});

describe("WhatsAppDiagnosticsPanel — test send", () => {
  it("calls the test-send action and renders a sent result", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה/ }));

    await waitFor(() => expect(m.runWhatsAppTestSendAction).toHaveBeenCalled());
    expect(
      await screen.findByText("הודעת בדיקה נשלחה למספר הבדיקה. בדקי את המכשיר שמחובר למספר הבדיקה."),
    ).toBeInTheDocument();
    expect(screen.getByText("סטטוס: sent")).toBeInTheDocument();
  });

  it("renders a failed test-send result without a status line when status missing", async () => {
    const user = userEvent.setup();
    m.runWhatsAppTestSendAction.mockResolvedValue(
      testSendResult({ sent: false, status: undefined, message: "שליחת הבדיקה לא בוצעה." }),
    );
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה/ }));

    expect(await screen.findByText("שליחת הבדיקה לא בוצעה.")).toBeInTheDocument();
    expect(screen.queryByText(/^סטטוס:/)).not.toBeInTheDocument();
  });

  it("does not perform any real send — only the mocked action is invoked", async () => {
    const user = userEvent.setup();
    render(<WhatsAppDiagnosticsPanel clients={CLIENTS} />);
    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה/ }));
    await waitFor(() => expect(m.runWhatsAppTestSendAction).toHaveBeenCalledTimes(1));
    expect(m.runWhatsAppTestSendAction).toHaveBeenCalledWith();
  });
});
