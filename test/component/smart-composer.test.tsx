// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartComposer } from "@/components/messages/smart-composer";
import type {
  ComposerBookingOption,
  ComposerClientOption,
} from "@/server/messages/queries";

const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
function makeUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
});

const bookings: ComposerBookingOption[] = [
  {
    id: "bk1",
    label: "נועה · לק ג׳ל · 12 ביוני",
    clientName: "נועה",
    serviceName: "לק ג׳ל",
    bookingDate: "יום שני, 12 ביוני",
    bookingTime: "10:00",
    price: "₪120",
  },
];

const clients: ComposerClientOption[] = [
  { id: "cl1", label: "מיכל", clientName: "מיכל" },
];

function renderComposer(props: Partial<Parameters<typeof SmartComposer>[0]> = {}) {
  return render(
    <SmartComposer
      businessName="הסטודיו של יעל"
      bookings={bookings}
      clients={clients}
      {...props}
    />,
  );
}

describe("SmartComposer", () => {
  it("renders header and scenario buttons, no preview before a scenario is chosen", () => {
    renderComposer();
    expect(screen.getByText("יצירת הודעה חכמה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "אישור תור" })).toBeInTheDocument();
    expect(screen.queryByText("תצוגת הודעה")).not.toBeInTheDocument();
  });

  it("shows missing-context message for a booking scenario before a booking is picked", async () => {
    const user = makeUser();
    renderComposer();
    await user.click(screen.getByRole("button", { name: "אישור תור" }));
    // Booking selector appears
    expect(screen.getByText("תור")).toBeInTheDocument();
    // No booking selected → missing-context guidance
    expect(
      screen.getByText("כדי להכין אישור תור, יש לבחור תור קיים."),
    ).toBeInTheDocument();
  });

  it("builds a real WhatsApp message once a booking is selected and copies it", async () => {
    const user = makeUser();
    renderComposer();
    await user.click(screen.getByRole("button", { name: "אישור תור" }));
    await user.selectOptions(screen.getByRole("combobox"), "bk1");
    // Real generated body
    expect(
      screen.getByText(
        /היי נועה, התור שלך ל־לק ג׳ל אצל הסטודיו של יעל נקבע ל־יום שני, 12 ביוני בשעה 10:00/,
      ),
    ).toBeInTheDocument();
    // Copy
    await user.click(screen.getByRole("button", { name: "העתקת הודעה" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("היי נועה");
  });

  it("switches tone and regenerates the message body", async () => {
    const user = makeUser();
    renderComposer();
    await user.click(screen.getByRole("button", { name: "אישור תור" }));
    await user.selectOptions(screen.getByRole("combobox"), "bk1");
    await user.click(screen.getByRole("button", { name: "חם יותר" }));
    expect(
      screen.getByText(/שמחים לאשר את התור שלך/),
    ).toBeInTheDocument();
  });

  it("resets back to no scenario via the reset button", async () => {
    const user = makeUser();
    renderComposer();
    await user.click(screen.getByRole("button", { name: "אישור תור" }));
    await user.selectOptions(screen.getByRole("combobox"), "bk1");
    await user.click(screen.getByRole("button", { name: "איפוס" }));
    expect(screen.queryByText("תצוגת הודעה")).not.toBeInTheDocument();
  });

  it("uses the client selector for client-only scenarios", async () => {
    const user = makeUser();
    renderComposer();
    await user.click(screen.getByRole("button", { name: "קביעת תור חוזר" }));
    expect(screen.getByText("לקוחה")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "cl1");
    expect(screen.getByText(/היי מיכל/)).toBeInTheDocument();
  });

  it("renders empty-state copy when no bookings or clients exist", async () => {
    const user = makeUser();
    renderComposer({ bookings: [], clients: [] });
    await user.click(screen.getByRole("button", { name: "אישור תור" }));
    expect(screen.getByText("אין תורים זמינים להצגה כרגע.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "קביעת תור חוזר" }));
    expect(screen.getByText("אין לקוחות זמינים כרגע.")).toBeInTheDocument();
  });

  it("highlights the active scenario button", async () => {
    const user = makeUser();
    renderComposer();
    const btn = screen.getByRole("button", { name: "תזכורת לתור" });
    await user.click(btn);
    expect(btn.className).toContain("bg-foreground");
  });
});
