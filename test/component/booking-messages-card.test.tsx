// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ resolveTemplate: vi.fn() }));
vi.mock("@/server/messages/queries", () => ({
  resolveTemplate: m.resolveTemplate,
}));

import { BookingMessagesCard } from "@/components/messages/booking-messages-card";

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

const tenant = { businessId: "biz-1" } as never;
const props = {
  tenant,
  clientName: "נועה",
  businessName: "סטודיו יופי",
  serviceName: "לק ג׳ל",
  bookingDate: "יום שני, 12 ביוני",
  bookingTime: "10:00",
  price: "₪120",
};

describe("BookingMessagesCard (async server component)", () => {
  it("renders a copy button per resolved template with rendered Hebrew text", async () => {
    m.resolveTemplate.mockImplementation((_t: unknown, type: string) => {
      if (type === "booking_confirmation")
        return Promise.resolve(
          "היי {clientName}, התור שלך ל־{serviceName} ב־{bookingDate} בשעה {bookingTime}.",
        );
      return Promise.resolve(null);
    });

    const ui = await BookingMessagesCard(props);
    const user = makeUser();
    render(ui);

    expect(screen.getByText("הודעות וואטסאפ")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "העתקת אישור תור" });
    await user.click(btn);
    // The rendered template (vars substituted) is what gets copied.
    expect(writeText.mock.calls[0][0]).toContain(
      "היי נועה, התור שלך ל־לק ג׳ל ב־יום שני, 12 ביוני בשעה 10:00.",
    );
  });

  it("returns null when no template resolves", async () => {
    m.resolveTemplate.mockResolvedValue(null);
    const ui = await BookingMessagesCard(props);
    expect(ui).toBeNull();
  });
});
