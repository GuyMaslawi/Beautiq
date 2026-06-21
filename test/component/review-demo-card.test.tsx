// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewDemoCard } from "@/components/whatsapp/review-demo-card";
import type { ReviewDemoStatus, ReviewDemoCheck } from "@/server/whatsapp/review-demo";

/**
 * Admin-only Meta App Review demo card.
 * The test-send hits POST /api/admin/whatsapp/review-test-send — fetch is mocked
 * so NO real request/send ever leaves the test. We assert the rendered Hebrew
 * copy, the guard checklist, gating of the send button, and every result branch.
 */

function check(over: Partial<ReviewDemoCheck> & { label: string; ok: boolean }): ReviewDemoCheck {
  return over;
}

function status(over: Partial<ReviewDemoStatus> = {}): ReviewDemoStatus {
  return {
    canTestSend: true,
    state: "ready",
    message: "ניתן לשלוח הודעת בדיקה למספר שהוגדר לצורך סקירת Meta.",
    displayPhoneNumber: "+972 50-000-0000",
    checks: [
      check({ label: "שליחה אמיתית מופעלת (ENABLE_REAL_WHATSAPP_SEND)", ok: true }),
      check({ label: "מספר נמען לבדיקה מוגדר (WHATSAPP_TEST_PHONE)", ok: true, value: "•••• 1234" }),
      check({ label: "חיבור WhatsApp פעיל לעסק", ok: false }),
    ],
    ...over,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, status: "sent", providerMessageId: "wamid.ABC" }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReviewDemoCard — render", () => {
  it("renders the admin header copy and badge", () => {
    render(<ReviewDemoCard status={status()} businessId="b1" />);
    expect(screen.getByText("סקירת Meta — מצב הדגמה")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(
      screen.getByText("סטטוס חיבור, תבניות והרשאות לשליחת הודעת בדיקה אמיתית עבור סקירת Meta."),
    ).toBeInTheDocument();
  });

  it("renders the state message and connected display phone", () => {
    render(<ReviewDemoCard status={status()} businessId="b1" />);
    expect(
      screen.getByText("ניתן לשלוח הודעת בדיקה למספר שהוגדר לצורך סקירת Meta."),
    ).toBeInTheDocument();
    expect(screen.getByText("מספר מחובר: +972 50-000-0000")).toBeInTheDocument();
  });

  it("omits the connected number line when none is set", () => {
    render(<ReviewDemoCard status={status({ displayPhoneNumber: undefined })} businessId="b1" />);
    expect(screen.queryByText(/מספר מחובר:/)).not.toBeInTheDocument();
  });

  it("renders each guard check label and value", () => {
    render(<ReviewDemoCard status={status()} businessId="b1" />);
    expect(screen.getByText("שליחה אמיתית מופעלת (ENABLE_REAL_WHATSAPP_SEND)")).toBeInTheDocument();
    expect(screen.getByText("מספר נמען לבדיקה מוגדר (WHATSAPP_TEST_PHONE)")).toBeInTheDocument();
    expect(screen.getByText("•••• 1234")).toBeInTheDocument();
    expect(screen.getByText("חיבור WhatsApp פעיל לעסק")).toBeInTheDocument();
  });

  it("renders the not_connected state copy", () => {
    render(
      <ReviewDemoCard
        status={status({
          state: "not_connected",
          canTestSend: false,
          message: "כדי לשלוח הודעת WhatsApp אמיתית, יש להשלים קודם את חיבור Meta Embedded Signup.",
          blockReason: "חיבור WhatsApp עדיין לא הושלם.",
        })}
        businessId="b1"
      />,
    );
    expect(
      screen.getByText(
        "כדי לשלוח הודעת WhatsApp אמיתית, יש להשלים קודם את חיבור Meta Embedded Signup.",
      ),
    ).toBeInTheDocument();
  });
});

describe("ReviewDemoCard — send button gating", () => {
  it("disables the send button and shows the block reason when canTestSend is false", () => {
    render(
      <ReviewDemoCard
        status={status({ canTestSend: false, state: "connected_disabled", blockReason: "שליחה אמיתית כבויה (ENABLE_REAL_WHATSAPP_SEND)." })}
        businessId="b1"
      />,
    );
    expect(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ })).toBeDisabled();
    expect(screen.getByText("שליחה אמיתית כבויה (ENABLE_REAL_WHATSAPP_SEND).")).toBeInTheDocument();
  });

  it("enables the send button when canTestSend is true", () => {
    render(<ReviewDemoCard status={status()} businessId="b1" />);
    expect(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ })).not.toBeDisabled();
  });

  it("omits the block reason line when none is provided", () => {
    render(<ReviewDemoCard status={status({ canTestSend: false, blockReason: undefined })} businessId="b1" />);
    expect(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ })).toBeDisabled();
  });
});

describe("ReviewDemoCard — test send", () => {
  it("posts to the review-test-send endpoint with the business id", async () => {
    const user = userEvent.setup();
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/whatsapp/review-test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: "b1" }),
    });
  });

  it("renders a sent result with the provider message id and status", async () => {
    const user = userEvent.setup();
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("ההודעה נשלחה למספר הבדיקה.")).toBeInTheDocument();
    expect(screen.getByText("Message ID: wamid.ABC")).toBeInTheDocument();
    expect(screen.getByText("סטטוס: sent")).toBeInTheDocument();
  });

  it("renders a blocked result", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, blocked: true, status: "skipped", reason: "השליחה נחסמה על ידי שומר." }),
    });
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("השליחה נחסמה.")).toBeInTheDocument();
    expect(screen.getByText("השליחה נחסמה על ידי שומר.")).toBeInTheDocument();
    expect(screen.getByText("סטטוס: skipped")).toBeInTheDocument();
  });

  it("renders a generic not-sent result when failed and not blocked", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, status: "failed", reason: "הספק החזיר שגיאה." }),
    });
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("ההודעה לא נשלחה.")).toBeInTheDocument();
    expect(screen.getByText("הספק החזיר שגיאה.")).toBeInTheDocument();
  });

  it("shows the API error when the response is not ok and carries no reason", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "פעולה זו זמינה למנהלי מערכת בלבד." }),
    });
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("פעולה זו זמינה למנהלי מערכת בלבד.")).toBeInTheDocument();
    // The error branch does not render a result block.
    expect(screen.queryByText("ההודעה נשלחה למספר הבדיקה.")).not.toBeInTheDocument();
  });

  it("treats a not-ok response that carries a reason as a result, not an error", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, status: "failed", reason: "נחסם", error: "x" }),
    });
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("ההודעה לא נשלחה.")).toBeInTheDocument();
    expect(screen.getByText("נחסם")).toBeInTheDocument();
  });

  it("renders a caught fetch rejection as an error", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });

  it("does not render Message ID line when none is returned", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "sent" }),
    });
    render(<ReviewDemoCard status={status()} businessId="b1" />);

    await user.click(screen.getByRole("button", { name: /שליחת הודעת בדיקה ל-Meta/ }));

    expect(await screen.findByText("ההודעה נשלחה למספר הבדיקה.")).toBeInTheDocument();
    expect(screen.queryByText(/^Message ID:/)).not.toBeInTheDocument();
  });
});
