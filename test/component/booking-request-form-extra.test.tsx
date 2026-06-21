// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Complementary coverage for BookingRequestForm — calendar step, details step,
 * cancellation-policy gating, payment preview, error states and the success view.
 * The existing booking-request-form.test.tsx covers the service + quick-pick
 * steps; this file raises the rest. The bound server action is controllable so
 * we can drive success/error states out of useActionState.
 */
const { boundAction } = vi.hoisted(() => ({ boundAction: vi.fn(async () => ({})) }));
vi.mock("@/server/public-booking/actions", () => ({
  submitPublicBookingAction: { bind: () => boundAction },
}));

import { BookingRequestForm } from "@/app/b/[slug]/booking-request-form";
import type {
  PublicService,
  PublicCancellationPolicy,
} from "@/server/public-booking/queries";

const SERVICES: PublicService[] = [
  { id: "svc-1", name: "מניקור ג'ל", description: "תיאור", durationMinutes: 60, price: "150" },
];

const POLICY: PublicCancellationPolicy = {
  policyText: "ביטול עד 24 שעות מראש",
} as unknown as PublicCancellationPolicy;

function renderForm(props: Partial<Parameters<typeof BookingRequestForm>[0]> = {}) {
  return render(
    <BookingRequestForm
      slug="studio-yofi"
      services={SERVICES}
      cancellationPolicy={null}
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
    expect(await screen.findByText("אין שעות פנויות בתאריך זה")).toBeInTheDocument();
  });
});

describe("BookingRequestForm — details step", () => {
  async function advanceToDetails() {
    stubSlots(["09:00"]);
    renderForm({ initialServiceId: "svc-1", cancellationPolicy: POLICY });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(await screen.findByText("09:00"));
    await userEvent.click(screen.getByRole("button", { name: /המשך למילוי פרטים/ }));
  }

  it("renders name/phone/note fields and gates submit on the policy checkbox", async () => {
    await advanceToDetails();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
    expect(screen.getByLabelText("טלפון")).toBeInTheDocument();
    expect(screen.getByText("מדיניות ביטולים")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /שליחת בקשה לתור/ });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
  });
});

describe("BookingRequestForm — error state", () => {
  it("renders the server formError and a 'back to time' shortcut when slot is taken", async () => {
    boundAction.mockResolvedValue({
      formError: "השעה כבר תפוסה",
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
  it("renders the success screen with the chosen service and calendar/whatsapp links", async () => {
    boundAction.mockResolvedValue({ success: true });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("/slots?")
          ? Promise.resolve({ json: () => Promise.resolve({ slots: ["09:00"] }) })
          : Promise.resolve({ json: () => Promise.resolve({ groups: [] }) }),
      ),
    );
    renderForm({ initialServiceId: "svc-1", businessPhone: "0501234567" });
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

    expect(await screen.findByText("הבקשה נשלחה!")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    const calLink = screen.getByText(/הוספה ליומן/).closest("a");
    expect(calLink?.getAttribute("href")).toContain("calendar.google.com");
    const waLink = screen.getByText(/שלחי בוואטסאפ/).closest("a");
    expect(waLink?.getAttribute("href")).toContain("wa.me/972501234567");
  });
});

describe("BookingRequestForm — payment preview", () => {
  it("shows the secure-payment card and pay CTA when full payment is required", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("/slots?")
          ? Promise.resolve({ json: () => Promise.resolve({ slots: ["09:00"] }) })
          : Promise.resolve({ json: () => Promise.resolve({ groups: [] }) }),
      ),
    );
    renderForm({
      initialServiceId: "svc-1",
      paymentPolicy: {
        requirement: "full_payment",
        allowPayAtBusiness: false,
        instructions: "התשלום מראש מבטיח את התור",
      },
    });
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(screen.getByText("בחרי תאריך מהלוח"));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await userEvent.type(dateInput, "2026-07-01");
    await act(async () => { await Promise.resolve(); });
    await userEvent.click(await screen.findByText("09:00"));
    await userEvent.click(screen.getByRole("button", { name: /המשך למילוי פרטים/ }));

    expect(screen.getByText("התשלום מראש מבטיח את התור")).toBeInTheDocument();
  });
});
