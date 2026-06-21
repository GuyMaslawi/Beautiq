// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutomationMessageLog } from "@/components/automations/automation-message-log";
import type { AutomationMessageLogItem } from "@/server/automations/message-queries";

const m = vi.hoisted(() => ({
  retry: vi.fn((): Promise<{ success: boolean; error?: string }> =>
    Promise.resolve({ success: true }),
  ),
}));

vi.mock("@/server/automations/retry-action", () => ({
  retryAutomationMessageAction: m.retry,
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

function makeMsg(over: Partial<AutomationMessageLogItem> = {}): AutomationMessageLogItem {
  return {
    id: "msg-1",
    clientId: "c1",
    clientName: "דנה",
    bookingId: null,
    type: "morning_reminder",
    status: "sent",
    failureReason: null,
    retryCount: 0,
    createdAt: new Date("2026-06-10T08:00:00Z"),
    sentAt: new Date("2026-06-10T08:01:00Z"),
    ...over,
  } as AutomationMessageLogItem;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AutomationMessageLog — empty state", () => {
  it("renders the empty state when there are no messages", () => {
    render(<AutomationMessageLog messages={[]} />);
    expect(screen.getByText("עדיין לא נשלחו הודעות")).toBeInTheDocument();
    expect(screen.getByText("אחרי שתפעילי אוטומציות, ההודעות יופיעו כאן.")).toBeInTheDocument();
  });
});

describe("AutomationMessageLog — table", () => {
  it("renders the column headers and a row with mapped type/status labels", () => {
    render(<AutomationMessageLog messages={[makeMsg()]} />);
    expect(screen.getByText("תאריך")).toBeInTheDocument();
    expect(screen.getByText("פעולות")).toBeInTheDocument();
    expect(screen.getByText("תזכורת לתור")).toBeInTheDocument(); // morning_reminder
    expect(screen.getByText("נשלח")).toBeInTheDocument(); // sent
    expect(screen.getByText("דנה")).toBeInTheDocument();
  });

  it("links the client and booking when bookingId is present", () => {
    render(<AutomationMessageLog messages={[makeMsg({ bookingId: "bk-1" })]} />);
    expect(screen.getByRole("link", { name: "דנה" })).toHaveAttribute("href", "/clients/c1");
    expect(screen.getByText("לפרטי התור").closest("a")).toHaveAttribute("href", "/bookings/bk-1");
  });

  it("shows the retry-count suffix in singular/plural", () => {
    const { container, rerender } = render(
      <AutomationMessageLog messages={[makeMsg({ retryCount: 1 })]} />,
    );
    // Singular: "ניסיון חוזר".
    expect(container.textContent).toMatch(/1\s*ניסיון\s*חוזר/);
    rerender(<AutomationMessageLog messages={[makeMsg({ retryCount: 2 })]} />);
    // Plural: the correctly-formed "ניסיונות חוזרים" (not "ניסיוןות").
    expect(container.textContent).toMatch(/2\s*ניסיונות\s*חוזרים/);
    expect(container.textContent).not.toContain("ניסיוןות");
  });

  it("renders a footer with the message count", () => {
    render(<AutomationMessageLog messages={[makeMsg(), makeMsg({ id: "m2" })]} />);
    expect(screen.getByText("מציג 2 הודעות אחרונות")).toBeInTheDocument();
  });

  it("falls back to raw type/status when unknown", () => {
    render(<AutomationMessageLog messages={[makeMsg({ type: "weird_type", status: "weird_status" })]} />);
    expect(screen.getByText("weird_type")).toBeInTheDocument();
    expect(screen.getByText("weird_status")).toBeInTheDocument();
  });
});

describe("AutomationMessageLog — failure hints", () => {
  it("maps a delivery-code failure to a safe Hebrew hint", () => {
    render(
      <AutomationMessageLog
        messages={[makeMsg({ status: "failed", failureReason: "קוד: 131", retryCount: 0 })]}
      />,
    );
    expect(screen.getByText("שגיאת מסירה — כנראה מספר לא קיים בוואטסאפ")).toBeInTheDocument();
  });

  it("maps dev-mock, test-mode and connection failures", () => {
    const { rerender } = render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", failureReason: "מצב פיתוח" })]} />,
    );
    expect(screen.getByText("מצב פיתוח — לא נשלח")).toBeInTheDocument();

    rerender(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", failureReason: "מצב בדיקה" })]} />,
    );
    expect(screen.getByText("מצב בדיקה — נחסם")).toBeInTheDocument();

    rerender(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", failureReason: "חיבור לא תקין" })]} />,
    );
    expect(screen.getByText("חיבור WhatsApp לא מוגדר")).toBeInTheDocument();
  });

  it("uses a generic hint for other failure reasons", () => {
    render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", failureReason: "משהו אחר" })]} />,
    );
    expect(screen.getByText("שגיאה בשליחה")).toBeInTheDocument();
  });

  it("shows the sent timestamp note for a sent message with sentAt", () => {
    render(<AutomationMessageLog messages={[makeMsg({ status: "sent" })]} />);
    // The sentAt formatted date appears in the note cell (Clock icon row).
    const cells = screen.getAllByText(/\d{1,2}\.\d{1,2}\.\d{2}/);
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders an em-dash when there is no hint or sent time", () => {
    render(<AutomationMessageLog messages={[makeMsg({ status: "queued", sentAt: null })]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("AutomationMessageLog — retry button", () => {
  it("only shows retry for failed messages under the retry cap", () => {
    const { rerender } = render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", retryCount: 0, failureReason: "x" })]} />,
    );
    expect(screen.getByRole("button", { name: "נסה שוב" })).toBeInTheDocument();

    rerender(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", retryCount: 3, failureReason: "x" })]} />,
    );
    expect(screen.queryByRole("button", { name: "נסה שוב" })).not.toBeInTheDocument();
  });

  it("shows a success message after a successful retry", async () => {
    const user = userEvent.setup();
    render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", retryCount: 0, failureReason: "x" })]} />,
    );
    await user.click(screen.getByRole("button", { name: "נסה שוב" }));
    expect(await screen.findByText("נשלח מחדש בהצלחה")).toBeInTheDocument();
    expect(m.retry).toHaveBeenCalledWith("msg-1");
  });

  it("shows the error message when retry fails", async () => {
    m.retry.mockResolvedValueOnce({ success: false, error: "כשל בשליחה חוזרת" });
    const user = userEvent.setup();
    render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", retryCount: 1, failureReason: "x" })]} />,
    );
    await user.click(screen.getByRole("button", { name: "נסה שוב" }));
    expect(await screen.findByText("כשל בשליחה חוזרת")).toBeInTheDocument();
  });

  it("uses a default error message when retry returns no error string", async () => {
    m.retry.mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();
    render(
      <AutomationMessageLog messages={[makeMsg({ status: "failed", retryCount: 0, failureReason: "x" })]} />,
    );
    await user.click(screen.getByRole("button", { name: "נסה שוב" }));
    expect(await screen.findByText("שליחה נכשלה")).toBeInTheDocument();
  });
});
