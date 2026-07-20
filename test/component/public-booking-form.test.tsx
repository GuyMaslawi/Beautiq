// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/server/public-booking/actions", () => ({
  submitPublicBookingAction: vi.fn(async () => ({})),
}));

import { BookingRequestForm } from "@/app/b/[slug]/booking-request-form";
import { BookingUnavailable } from "@/app/b/[slug]/_components/booking-empty";
import { submitPublicBookingAction } from "@/server/public-booking/actions";
import type { PublicService } from "@/server/public-booking/queries";

const action = vi.mocked(submitPublicBookingAction);

const SERVICES: PublicService[] = [
  {
    id: "svc-1",
    name: "מניקור ג'ל",
    description: "עיצוב מלא",
    durationMinutes: 60,
    price: "150",
  },
];

const GROUPS = [{ label: "היום", date: "2026-07-01", slots: ["10:00"] }];

function stubFetch(slots: string[] = ["10:00"], groups = GROUPS) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: unknown) => {
      const u = String(url);
      const body = u.includes("upcoming-slots") ? { groups } : { slots };
      return Promise.resolve({ json: () => Promise.resolve(body) });
    }),
  );
}

function renderForm() {
  return render(
    <BookingRequestForm
      slug="studio-yofi"
      services={SERVICES}
      businessName="סטודיו יופי"
    />,
  );
}

/** Drive the wizard from the service step to the details step. */
async function goToDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("מניקור ג'ל"));
  await user.click(
    screen.getByRole("button", { name: /המשך לבחירת תאריך ושעה/ }),
  );
  // Quick-pick slot appears once upcoming-slots resolves.
  const slot = await screen.findByRole("button", { name: "10:00" });
  await user.click(slot);
}

beforeEach(() => {
  action.mockReset();
  action.mockResolvedValue({});
});

describe("BookingRequestForm — primary flow", () => {
  it("shows the active services immediately on the service step", () => {
    stubFetch();
    renderForm();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("באיזה שירות את מעוניינת?")).toBeInTheDocument();
  });

  it("renders the premium success screen with the required copy and summary", async () => {
    stubFetch();
    action.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderForm();

    await goToDetails(user);
    await user.type(screen.getByLabelText("שם מלא"), "נועה כהן");
    await user.type(screen.getByLabelText("טלפון"), "0501234567");
    await user.click(screen.getByRole("button", { name: /קביעת תור/ }));

    expect(await screen.findByText("התור נקבע בהצלחה")).toBeInTheDocument();
    expect(
      screen.getByText(/התור שלך נקבע/),
    ).toBeInTheDocument();
    // Booking summary on the success card.
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText(/בשעה 10:00/)).toBeInTheDocument();
  });

  it("surfaces a slot-conflict error on the details step with a way back to time selection", async () => {
    stubFetch();
    action.mockResolvedValue({
      formError: "השעה שבחרת כבר נתפסה",
      slotConflict: true,
    });
    const user = userEvent.setup();
    renderForm();

    await goToDetails(user);
    await user.type(screen.getByLabelText("שם מלא"), "נועה כהן");
    await user.type(screen.getByLabelText("טלפון"), "0501234567");
    await user.click(screen.getByRole("button", { name: /קביעת תור/ }));

    expect(await screen.findByText("השעה שבחרת כבר נתפסה")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "חזרה לבחירת שעה" }),
    ).toBeInTheDocument();
  });

  it("shows a 'no slots' empty state on the calendar when a day has none", async () => {
    stubFetch([], []); // no upcoming slots, no per-day slots
    const user = userEvent.setup();
    const { container } = renderForm();

    await user.click(screen.getByText("מניקור ג'ל"));
    await user.click(
      screen.getByRole("button", { name: /המשך לבחירת תאריך ושעה/ }),
    );
    // Quick-pick empty → jump to the full calendar.
    const toCalendar = await screen.findByRole("button", {
      name: /בחרי תאריך מהלוח/,
    });
    await user.click(toCalendar);

    const dateInput = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "2026-07-01" } });
    });

    expect(await screen.findByText("אין שעות פנויות ביום הזה")).toBeInTheDocument();
  });
});

describe("BookingUnavailable — no active services", () => {
  it("renders the premium Hebrew empty state with a contact path", () => {
    render(
      <BookingUnavailable
        brand="#b86b8c"
        phone="050-1234567"
        businessName="סטודיו יופי"
      />,
    );
    expect(
      screen.getByText("העסק עדיין לא פרסם שירותים להזמנה"),
    ).toBeInTheDocument();
    const tel = screen.getByText("050-1234567").closest("a");
    expect(tel).toHaveAttribute("href", "tel:050-1234567");
  });

  it("omits the contact path when there is no phone", () => {
    render(
      <BookingUnavailable brand="#b86b8c" phone={null} businessName="סטודיו" />,
    );
    expect(
      screen.getByText("העסק עדיין לא פרסם שירותים להזמנה"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/בוואטסאפ/)).not.toBeInTheDocument();
  });
});
