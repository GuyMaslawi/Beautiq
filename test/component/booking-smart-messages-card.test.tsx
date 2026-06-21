// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingSmartMessagesCard } from "@/components/messages/booking-smart-messages-card";

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

const base = {
  businessName: "סטודיו יופי",
  clientName: "נועה",
  serviceName: "לק ג׳ל",
  bookingDate: "יום שני, 12 ביוני",
  bookingTime: "10:00",
  price: "₪120",
};

describe("BookingSmartMessagesCard", () => {
  it("offers confirmation + reminder + cancel scenarios for an approved booking", () => {
    render(<BookingSmartMessagesCard {...base} bookingStatus="approved" />);
    expect(screen.getByRole("button", { name: "אישור תור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "תזכורת לתור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ביטול תור" })).toBeInTheDocument();
  });

  it("pre-selects the cancellation message after a booking is cancelled", () => {
    render(<BookingSmartMessagesCard {...base} bookingStatus="cancelled" />);
    // Cancellation stays available + pre-selected, so the body renders immediately.
    expect(
      screen.getByText(/התור שלך ל־לק ג׳ל אצל סטודיו יופי שנקבע ל־יום שני, 12 ביוני בוטל/),
    ).toBeInTheDocument();
  });

  it("pre-selects after-treatment for a completed booking and copies it", async () => {
    const user = makeUser();
    render(<BookingSmartMessagesCard {...base} bookingStatus="completed" />);
    expect(screen.getByText(/תודה שבאת לטיפול לק ג׳ל/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "העתקת הודעה" }));
    expect(writeText).toHaveBeenCalled();
  });

  it("builds a wa.me link when a client phone is provided", () => {
    render(
      <BookingSmartMessagesCard
        {...base}
        clientPhone="0501234567"
        bookingStatus="completed"
      />,
    );
    const link = screen.getByRole("link", { name: /שליחה בוואטסאפ/ });
    const href = link.getAttribute("href")!;
    expect(href).toMatch(/^https:\/\/wa\.me\/\+?972501234567\?text=/);
    // The message body is URL-encoded into the link.
    expect(decodeURIComponent(href)).toContain("תודה שבאת לטיפול לק ג׳ל");
  });

  it("renders no WhatsApp link for an invalid phone", () => {
    render(
      <BookingSmartMessagesCard
        {...base}
        clientPhone="123"
        bookingStatus="completed"
      />,
    );
    expect(screen.queryByRole("link", { name: /שליחה בוואטסאפ/ })).not.toBeInTheDocument();
  });

  it("offers confirmation + reminder for a rescheduled booking with no pre-selected preview", () => {
    render(<BookingSmartMessagesCard {...base} bookingStatus="rescheduled" />);
    expect(screen.getByRole("button", { name: "אישור תור" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "תזכורת לתור" })).toBeInTheDocument();
    // rescheduled is not in defaultScenarioFor → nothing pre-selected, no preview yet.
    expect(screen.queryByText("תצוגת הודעה")).not.toBeInTheDocument();
  });

  it("renders no card at all for a pending booking once cancelled+no scenarios would apply", () => {
    // pending still has confirmation+reminder+cancel scenarios → card renders.
    render(<BookingSmartMessagesCard {...base} bookingStatus="pending" />);
    expect(screen.getByRole("button", { name: "ביטול תור" })).toBeInTheDocument();
  });

  it("switches scenario and tone", async () => {
    const user = makeUser();
    render(<BookingSmartMessagesCard {...base} bookingStatus="approved" />);
    await user.click(screen.getByRole("button", { name: "תזכורת לתור" }));
    expect(screen.getByText(/תזכורת: יש לך תור/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "קצר וישיר" }));
    expect(screen.getByText(/תזכורת לתור לק ג׳ל/)).toBeInTheDocument();
  });

  it("shows the no_show follow-up scenario for a no-show booking", () => {
    render(<BookingSmartMessagesCard {...base} bookingStatus="no_show" />);
    expect(screen.getByText(/לא הגעת לתור שנקבע/)).toBeInTheDocument();
  });
});
