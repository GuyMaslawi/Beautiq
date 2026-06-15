// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/server/public-booking/actions", () => ({
  submitPublicBookingAction: vi.fn(async () => ({})),
}));

import { BookingRequestForm } from "@/app/b/[slug]/booking-request-form";
import {
  BookingSelectionProvider,
  AppointmentSummary,
} from "@/app/b/[slug]/_components/booking-selection";
import type { PublicService } from "@/server/public-booking/queries";

const SERVICES: PublicService[] = [
  {
    id: "svc-1",
    name: "מניקור ג'ל",
    description: null,
    durationMinutes: 60,
    price: "150",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ groups: [], slots: [] }) }),
    ),
  );
});

function renderExperience() {
  return render(
    <BookingSelectionProvider>
      <AppointmentSummary brand="#b86b8c" businessPhone="0501234567" />
      <BookingRequestForm
        slug="studio-yofi"
        services={SERVICES}
        cancellationPolicy={null}
        businessName="סטודיו יופי"
      />
    </BookingSelectionProvider>,
  );
}

describe("Booking selection — desktop right-column summary", () => {
  it("stays hidden until a service is chosen, then mirrors the selection (flow intact)", async () => {
    renderExperience();

    // Hidden on the service step.
    expect(screen.queryByText("התור שלך")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("מניקור ג'ל"));
    await userEvent.click(
      screen.getByRole("button", { name: /המשך לבחירת תאריך ושעה/ }),
    );

    // Flow still advances to the date step…
    expect(screen.getByText("התורים הקרובים")).toBeInTheDocument();
    // …and the right-column summary now reflects the choice.
    expect(screen.getByText("התור שלך")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
  });
});
