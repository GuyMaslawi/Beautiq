// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Complementary coverage for BookingRequestForm — calendar step, details step,
 * error states and the success view. The existing booking-request-form.test.tsx
 * covers the service + quick-pick steps; this file raises the rest. The bound
 * server action is controllable so we can drive success/error states out of
 * useActionState.
 */
const { boundAction } = vi.hoisted(() => ({ boundAction: vi.fn(async () => ({})) }));
vi.mock("@/server/public-booking/actions", () => ({
  submitPublicBookingAction: { bind: () => boundAction },
}));

import { BookingRequestForm } from "@/app/b/[slug]/booking-request-form";
import type { PublicService } from "@/server/public-booking/queries";

const SERVICES: PublicService[] = [
  { id: "svc-1", name: "מניקור ג'ל", description: "תיאור", durationMinutes: 60, price: "150" },
];

function renderForm(props: Partial<Parameters<typeof BookingRequestForm>[0]> = {}) {
  return render(
    <BookingRequestForm
      slug="studio-yofi"
      services={SERVICES}
      businessName="סטודיו יופי"
      {...props}
    />,
  );
}

beforeEach(() => {
  boundAction.mockReset().mockResolvedValue({});
});

function stubSlots(slots: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/slots?")) {
        return Promise.resolve({ json: () => Promise.resolve({ slots }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ groups: [] }) });
    }),
  );
}

describe("BookingRequestForm — full calendar step", () => {
  it("opens the calendar from quick-pick and shows slot pills after a date is chosen", async () => {
    stubSlots(["09:00", "10:00"]);
    renderForm({ initialServiceId: "svc-1" });
    await act(async () => { await Promise.resolve(); });

    // Quick-pick has no slots → "בחרי תאריך מהלוח" appears.
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });

    expect(await screen.findByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("10:00")).toBeInTheDocument();

    // Selecting a slot enables continue.
    await userEvent.click(screen.getByText("09:00"));
    const cont = screen.getByRole("button", { name: /המשך למילוי פרטים/ });
    expect(cont).toBeEnabled();
  });

  it("shows the empty-state when the calendar returns no slots", async () => {
    stubSlots([]);
    renderForm({ initialServiceId: "svc-1" });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    expect(await screen.findByText("אין שעות פנויות ביום הזה")).toBeInTheDocument();
  });
});

describe("BookingRequestForm — details step", () => {
  async function advanceToDetails() {
    stubSlots(["09:00"]);
    renderForm({ initialServiceId: "svc-1" });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(await screen.findByText("09:00"));
    await userEvent.click(screen.getByRole("button", { name: /המשך למילוי פרטים/ }));
  }

  it("renders name/phone/note fields with no policy, consent or payment cards", async () => {
    await advanceToDetails();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
    expect(screen.getByLabelText("טלפון")).toBeInTheDocument();

    // Cancellation policy, WhatsApp/marketing consent and payment are all gone.
    expect(screen.queryByText("מדיניות ביטולים")).not.toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/שיווקיים/)).not.toBeInTheDocument();
    expect(screen.queryByText(/תשלום/)).not.toBeInTheDocument();

    // The submit button is enabled immediately — no consent gates it.
    const submit = screen.getByRole("button", { name: /שליחת בקשה לתור/ });
    expect(submit).toBeEnabled();
  });
});

describe("BookingRequestForm — error state", () => {
  it("renders the server formError and a 'back to time' shortcut when slot is taken", async () => {
    boundAction.mockResolvedValue({
      formError: "השעה כבר תפוסה",
      slotConflict: true,
      errors: { clientName: "נא להזין שם" },
    });
    // Start on quick-pick, jump to details via calendar then submit.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("/slots?")
          ? Promise.resolve({ json: () => Promise.resolve({ slots: ["09:00"] }) })
          : Promise.resolve({ json: () => Promise.resolve({ groups: [] }) }),
      ),
    );
    renderForm({ initialServiceId: "svc-1" });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(await screen.findByText("09:00"));
    await userEvent.click(screen.getByRole("button", { name: /המשך למילוי פרטים/ }));
    await userEvent.click(screen.getByRole("button", { name: /שליחת בקשה לתור/ }));

    expect(await screen.findByText("השעה כבר תפוסה")).toBeInTheDocument();
    expect(screen.getByText("חזרה לבחירת שעה")).toBeInTheDocument();
    expect(screen.getByText("נא להזין שם")).toBeInTheDocument();
  });
});

describe("BookingRequestForm — success view", () => {
  it("renders a clean success screen with the service + calendar link and NO WhatsApp CTA", async () => {
    boundAction.mockResolvedValue({ success: true });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("/slots?")
          ? Promise.resolve({ json: () => Promise.resolve({ slots: ["09:00"] }) })
          : Promise.resolve({ json: () => Promise.resolve({ groups: [] }) }),
      ),
    );
    renderForm({ initialServiceId: "svc-1" });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(await screen.findByText("09:00"));
    await userEvent.click(screen.getByRole("button", { name: /המשך למילוי פרטים/ }));
    await userEvent.type(screen.getByLabelText("שם מלא"), "נועה");
    await userEvent.type(screen.getByLabelText("טלפון"), "0501234567");
    await userEvent.click(screen.getByRole("button", { name: /שליחת בקשה לתור/ }));

    expect(await screen.findByText("בקשת התור נשלחה")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();

    // Subtitle sets the right expectation: the owner approves the request.
    expect(
      screen.getByText(/בעלת העסק תקבל את הבקשה ותאשר את התור/),
    ).toBeInTheDocument();

    // "הוספה ליומן" stays.
    const calLink = screen.getByText(/הוספה ליומן/).closest("a");
    expect(calLink?.getAttribute("href")).toContain("calendar.google.com");

    // The customer is never asked to notify the owner over WhatsApp.
    expect(screen.queryByText(/שלחי בוואטסאפ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/בוואטסאפ/)).not.toBeInTheDocument();
    expect(
      document.querySelector('a[href*="wa.me"]'),
    ).not.toBeInTheDocument();

    // "שליחת בקשה נוספת" remains as a secondary action.
    expect(screen.getByText("שליחת בקשה נוספת")).toBeInTheDocument();
  });
});
