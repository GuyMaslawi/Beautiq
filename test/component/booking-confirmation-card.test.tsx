// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingConfirmationCard } from "@/components/automations/booking-confirmation-card";
import type { AutomationSetting } from "@prisma/client";

const m = vi.hoisted(() => ({
  save: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/server/booking-confirmation/actions", () => ({
  saveBookingConfirmationSettingsAction: m.save,
}));

function makeSetting(over: Partial<AutomationSetting> = {}): AutomationSetting {
  return {
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

describe("BookingConfirmationCard — card", () => {
  it("renders the title, description and 'פעיל תמיד' when unlocked", () => {
    render(<BookingConfirmationCard setting={makeSetting()} />);
    expect(screen.getByText("אישור תור")).toBeInTheDocument();
    expect(screen.getByText("פעיל תמיד")).toBeInTheDocument();
    expect(screen.getByText(/הודעה אוטומטית ללקוחה/)).toBeInTheDocument();
  });

  it("shows the locked state and disables the settings button for non-admins", () => {
    render(<BookingConfirmationCard setting={null} locked />);
    expect(screen.getByText("זמין אחרי חיבור WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הגדרה" })).toBeDisabled();
  });

  it("keeps the settings button enabled for admins even when locked", () => {
    render(<BookingConfirmationCard setting={null} locked isAdmin />);
    expect(screen.getByRole("button", { name: "הגדרה" })).toBeEnabled();
  });

  it("shows the 'ready' readiness badge when template is approved and real send configured", () => {
    render(
      <BookingConfirmationCard
        setting={makeSetting({ templateName: "booking_confirmation_he", templateStatus: "approved" })}
        realSendConfigured
      />,
    );
    expect(screen.getByText("מוכן לשליחה")).toBeInTheDocument();
  });

  it("does not render the readiness badge when locked", () => {
    render(<BookingConfirmationCard setting={makeSetting({ templateStatus: "approved" })} realSendConfigured locked />);
    expect(screen.queryByText("מוכן לשליחה")).not.toBeInTheDocument();
  });
});

describe("BookingConfirmationCard — settings dialog", () => {
  it("opens the dialog and shows the configuration fields", async () => {
    const user = userEvent.setup();
    render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));

    expect(screen.getByText("הגדרות אישור תור")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("booking_confirmation_he")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "דרישת אישור WhatsApp" })).toBeInTheDocument();
  });

  it("closes the dialog via the X button", async () => {
    const user = userEvent.setup();
    render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    // The header X button has no accessible name; grab it by its position in the header.
    const heading = screen.getByText("הגדרות אישור תור");
    const closeBtn = within(heading.parentElement!).getByRole("button");
    await user.click(closeBtn);
    expect(screen.queryByText("הגדרות אישור תור")).not.toBeInTheDocument();
  });

  it("toggles requireOptIn and shows the matching helper text", async () => {
    const user = userEvent.setup();
    render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText(/אישור תור הוא הודעה עסקית/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "דרישת אישור WhatsApp" }));
    expect(screen.getByText(/יישלחו רק ללקוחות שנתנו הסכמה/)).toBeInTheDocument();
  });

  it("shows the admin diagnostic block only for admins", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.queryByText("Admin — סטטוס תבנית")).not.toBeInTheDocument();

    rerender(<BookingConfirmationCard setting={makeSetting()} isAdmin />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    expect(screen.getByText("Admin — סטטוס תבנית")).toBeInTheDocument();
    expect(screen.getByText("לא מוגדר")).toBeInTheDocument();
  });

  it("saves trimmed settings and shows the saved state on success", async () => {
    const user = userEvent.setup();
    render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));

    await user.type(screen.getByPlaceholderText("booking_confirmation_he"), "  my_template  ");
    await user.click(screen.getByRole("button", { name: "שמור" }));

    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith({
        requireOptIn: false,
        templateName: "my_template",
        templateLanguage: "he",
      }),
    );
    expect(await screen.findByText("נשמר ✓")).toBeInTheDocument();
  });

  it("shows the error message when the save action fails", async () => {
    m.save.mockResolvedValueOnce({ error: "שמירה נכשלה" });
    const user = userEvent.setup();
    render(<BookingConfirmationCard setting={makeSetting()} />);
    await user.click(screen.getByRole("button", { name: "הגדרה" }));
    await user.click(screen.getByRole("button", { name: "שמור" }));
    expect(await screen.findByText("שמירה נכשלה")).toBeInTheDocument();
  });
});
