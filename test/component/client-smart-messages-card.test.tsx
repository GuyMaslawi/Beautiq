// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientSmartMessagesCard } from "@/components/messages/client-smart-messages-card";

const writeText = vi.fn(() => Promise.resolve());
function makeUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
});

describe("ClientSmartMessagesCard", () => {
  it("always offers the rebook scenario and builds a real message", async () => {
    const user = makeUser();
    render(
      <ClientSmartMessagesCard
        businessName="סטודיו יופי"
        clientName="מיכל"
        hasNoShow={false}
        notReturnedRecently={false}
      />,
    );
    const btn = screen.getByRole("button", { name: "קביעת תור חוזר" });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(
      screen.getByText(/עבר זמן מה מאז התור האחרון שלך אצל סטודיו יופי/),
    ).toBeInTheDocument();
  });

  it("adds not_returned, after_treatment and no_show scenarios per flags", () => {
    render(
      <ClientSmartMessagesCard
        businessName="סטודיו יופי"
        clientName="מיכל"
        recentBookingServiceName="לק ג׳ל"
        hasNoShow
        notReturnedRecently
      />,
    );
    expect(screen.getByRole("button", { name: "לקוחה שלא חזרה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הודעה אחרי טיפול" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "לקוחה שלא הגיעה" })).toBeInTheDocument();
  });

  it("copies the generated message and switches tone", async () => {
    const user = makeUser();
    render(
      <ClientSmartMessagesCard
        businessName="סטודיו יופי"
        clientName="מיכל"
        hasNoShow={false}
        notReturnedRecently
      />,
    );
    await user.click(screen.getByRole("button", { name: "לקוחה שלא חזרה" }));
    await user.click(screen.getByRole("button", { name: "חם יותר" }));
    expect(screen.getByText(/מתגעגעים/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "העתקת הודעה" }));
    expect(writeText).toHaveBeenCalled();
  });

  it("does not render a preview before any scenario is selected", () => {
    render(
      <ClientSmartMessagesCard
        businessName="סטודיו יופי"
        clientName="מיכל"
        hasNoShow={false}
        notReturnedRecently={false}
      />,
    );
    expect(screen.queryByText("תצוגת הודעה")).not.toBeInTheDocument();
  });
});
