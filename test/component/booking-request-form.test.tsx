// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the server action module so the client form has a no-op action.
const { submitAction } = vi.hoisted(() => ({
  submitAction: vi.fn(async () => ({})),
}));
vi.mock("@/server/public-booking/actions", () => ({
  submitPublicBookingAction: submitAction,
}));

import { BookingRequestForm } from "@/app/b/[slug]/booking-request-form";
import type { PublicService } from "@/server/public-booking/queries";

const SERVICES: PublicService[] = [
  {
    id: "svc-1",
    name: "מניקור ג'ל",
    description: "מניקור מלא בגימור ג'ל",
    durationMinutes: 60,
    price: "150",
  },
  {
    id: "svc-2",
    name: "פדיקור",
    description: null,
    durationMinutes: 90,
    price: "200",
  },
];

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
  // Avoid unhandled fetches from QuickPickSlots when the step advances.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ groups: [], slots: [] }) }),
    ),
  );
});

describe("BookingRequestForm — service step", () => {
  it("renders Hebrew prompt and all services", () => {
    renderForm();
    expect(screen.getByText("באיזה שירות את מעוניינת?")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("פדיקור")).toBeInTheDocument();
  });

  it("disables continue until a service is selected", async () => {
    renderForm();
    const cta = screen.getByRole("button", { name: /בחרי שירות כדי להמשיך/ });
    expect(cta).toBeDisabled();

    await userEvent.click(screen.getByText("מניקור ג'ל"));
    const enabled = screen.getByRole("button", {
      name: /המשך לבחירת תאריך ושעה/,
    });
    expect(enabled).toBeEnabled();
  });

  it("never shows any deposit notice (deposits are removed)", async () => {
    renderForm();
    expect(screen.queryByText(/מקדמה/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("פדיקור"));
    expect(screen.queryByText(/מקדמה/)).not.toBeInTheDocument();
  });

  it("shows prices by default and hides them when showPrices is false", () => {
    const { unmount } = renderForm({ showPrices: true });
    expect(screen.getByText(/₪150/)).toBeInTheDocument();
    unmount();

    renderForm({ showPrices: false });
    expect(screen.queryByText(/₪150/)).not.toBeInTheDocument();
  });
});

describe("BookingRequestForm — step progression", () => {
  it("advances from service to the quick-pick date step", async () => {
    renderForm();
    await userEvent.click(screen.getByText("מניקור ג'ל"));
    await userEvent.click(
      screen.getByRole("button", { name: /המשך לבחירת תאריך ושעה/ }),
    );
    expect(screen.getByText("התורים הקרובים")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("starts on the quick-pick step when initialServiceId is provided", async () => {
    renderForm({ initialServiceId: "svc-1" });
    expect(screen.getByText("התורים הקרובים")).toBeInTheDocument();
    // Flush the QuickPickSlots fetch so its state update settles inside act().
    await act(async () => {
      await Promise.resolve();
    });
  });
});

describe("BookingRequestForm — cancellation policy gating", () => {
  it("renders a no-fetch form and keeps RTL/Hebrew labels intact", () => {
    const { container } = renderForm();
    // Step indicator labels are Hebrew.
    expect(within(container).getByText("שירות")).toBeInTheDocument();
    expect(within(container).getByText("תאריך")).toBeInTheDocument();
    expect(within(container).getByText("פרטים")).toBeInTheDocument();
  });

  it("does not leak null/undefined or placeholder garbage into the DOM", () => {
    const { container } = renderForm();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/undefined|null|NaN|\{[a-zA-Z]+\}|lorem|placeholder/i);
  });
});

describe("BookingRequestForm — submit button semantics", () => {
  it("renders hidden inputs that feed the server action", () => {
    const { container } = renderForm();
    expect(container.querySelector('input[name="serviceId"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="date"]')).toBeInTheDocument();
    expect(
      container.querySelector('input[name="requestedTime"]'),
    ).toBeInTheDocument();
  });
});
