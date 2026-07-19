// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewRequestCard } from "@/components/automations/review-request-card";
import type { AutomationSetting } from "@prisma/client";

const m = vi.hoisted(() => ({
  toggle: vi.fn(() => Promise.resolve({ success: true })),
  saveTiming: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/server/review-request/actions", () => ({
  toggleReviewRequestAction: m.toggle,
  saveReviewRequestTimingAction: m.saveTiming,
}));

function makeSetting(over: Partial<AutomationSetting> = {}): AutomationSetting {
  return {
    enabled: false,
    sendHour: 24,
    messageTemplate: null,
    offerValue: "",
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

describe("ReviewRequestCard — card", () => {
  it("renders the title, off state and sent-this-month note", () => {
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={4} />);
    expect(screen.getByText("בקשת ביקורת")).toBeInTheDocument();
    expect(screen.getByText("כבוי")).toBeInTheDocument();
    expect(screen.getByText("נשלחו 4 בקשות החודש")).toBeInTheDocument();
  });

  it("shows the active state when enabled", () => {
    render(<ReviewRequestCard setting={makeSetting({ enabled: true })} sentThisMonth={0} />);
    expect(screen.getByText("פעיל")).toBeInTheDocument();
  });

  it("toggles the automation and calls the action", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת בקשת ביקורת" }));
    expect(m.toggle).toHaveBeenCalledWith(true);
    expect(await screen.findByText("פעיל")).toBeInTheDocument();
  });

  it("reverts the toggle when the action fails", async () => {
    m.toggle.mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("switch", { name: "הפעלת בקשת ביקורת" }));
    await waitFor(() => expect(screen.getByText("כבוי")).toBeInTheDocument());
  });
});

describe("ReviewRequestCard — locked state", () => {
  it("shows the locked label and disables settings", () => {
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={3} locked />);
    expect(screen.getByText("זמין אחרי חיבור WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הגדרה" })).toBeDisabled();
    expect(screen.queryByText(/נשלחו 3 בקשות/)).not.toBeInTheDocument();
  });

  it("shows a lock notice when the locked toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} locked />);
    await user.click(screen.getByRole("button", { name: "חברי WhatsApp כדי להפעיל" }));
    expect(screen.getByText("קודם צריך לחבר WhatsApp Business.")).toBeInTheDocument();
  });
});

describe("ReviewRequestCard — timing detection", () => {
  it("detects '1_hour' timing for a small sendHour", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting({ sendHour: 1 })} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByText("✨ מיד אחרי הביקור"));
    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    await waitFor(() =>
      expect(m.saveTiming).toHaveBeenCalledWith(expect.objectContaining({ hoursAfter: 1 })),
    );
  });

  it("detects '3_hours' timing for a mid sendHour", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting({ sendHour: 4 })} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText("🌙 בערב של אותו יום")).toBeInTheDocument();
  });
});

describe("ReviewRequestCard — settings dialog", () => {
  it("opens the dialog and shows timing options and a preview", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText("מתי לשלוח?")).toBeInTheDocument();
    expect(screen.getByText("☀️ למחרת")).toBeInTheDocument();
    expect(screen.getAllByText(/נועה/).length).toBeGreaterThan(0);
  });

  it("expands advanced, edits the review link and saves", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByRole("button", { name: /עריכה מתקדמת/ }));

    await user.type(
      screen.getByPlaceholderText("https://g.page/my-business/review"),
      "https://example.com/review",
    );
    await user.type(screen.getByPlaceholderText("review_request_he"), "tpl");

    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    await waitFor(() =>
      expect(m.saveTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewLink: "https://example.com/review",
          templateName: "tpl",
        }),
      ),
    );
  });

  // The "דרישת אישור WhatsApp" (requireOptIn) switch was removed from the
  // advanced section — requireOptIn is now hardcoded false — so its toggle +
  // helper text are no longer asserted. The message editor still opens here.
  it("opens the message editor from the advanced section", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByRole("button", { name: /עריכה מתקדמת/ }));

    await user.click(screen.getByRole("button", { name: /עריכת נוסח ההודעה/ }));
    expect(screen.getByText("נוסח ההודעה")).toBeInTheDocument();
  });

  it("shows the save error message when the action fails", async () => {
    m.saveTiming.mockResolvedValueOnce({ error: "שמירה נכשלה" });
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    const saveButtons = screen.getAllByRole("button", { name: "שמור" });
    await user.click(saveButtons[0]);
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });

  it("closes the dialog via the X button", async () => {
    const user = userEvent.setup();
    render(<ReviewRequestCard setting={makeSetting()} sentThisMonth={0} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    const heading = screen.getByText("בקשת ביקורת", { selector: "h2" });
    const closeBtn = within(heading.parentElement!).getByRole("button");
    await user.click(closeBtn);
    expect(screen.queryByText("מתי לשלוח?")).not.toBeInTheDocument();
  });

  it("renders the readiness badge when unlocked + configured", () => {
    render(
      <ReviewRequestCard
        setting={makeSetting({ templateName: "t", templateStatus: "approved" })}
        sentThisMonth={0}
        realSendConfigured
      />,
    );
    expect(screen.getByText("מוכן לשליחה")).toBeInTheDocument();
  });
});
