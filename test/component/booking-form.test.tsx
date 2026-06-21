// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingForm } from "@/components/bookings/booking-form";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingFormState } from "@/server/bookings/actions";
import React from "react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...rest }, children),
}));

const SERVICES = [
  { id: "s1", name: "מניקור ג'ל", durationMinutes: 60, price: "180" },
  { id: "s2", name: "פדיקור", durationMinutes: 90, price: "0" },
];

function noop() {
  return vi.fn(async () => ({}) as BookingFormState);
}

/** Stub fetch with a fixed slots payload. */
function stubSlots(payload: { open?: boolean; slots?: string[] }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(payload) }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  stubSlots({ open: true, slots: ["09:00", "10:00"] });
});

describe("BookingForm — empty services", () => {
  it("renders the no-active-service notice with a CTA when there are no services", () => {
    render(<BookingForm action={noop()} services={[]} />);
    expect(screen.getByText(BOOKINGS.form.serviceNoActive)).toBeInTheDocument();
    expect(screen.getByText(BOOKINGS.form.serviceNoActiveCta)).toBeInTheDocument();
  });
});

describe("BookingForm — structure", () => {
  it("renders all four sections and the initial client values", () => {
    render(
      <BookingForm
        action={noop()}
        services={SERVICES}
        initialClientName="נועה"
        initialClientPhone="0501234567"
      />,
    );
    expect(screen.getByText(BOOKINGS.form.sectionClient)).toBeInTheDocument();
    expect(screen.getByText(BOOKINGS.form.sectionService)).toBeInTheDocument();
    expect(screen.getByText(BOOKINGS.form.sectionDateTime)).toBeInTheDocument();
    expect(screen.getByText(BOOKINGS.form.sectionNotes)).toBeInTheDocument();

    expect((screen.getByLabelText(BOOKINGS.form.clientNameLabel) as HTMLInputElement).value).toBe(
      "נועה",
    );
    expect((screen.getByLabelText(BOOKINGS.form.phoneLabel) as HTMLInputElement).value).toBe(
      "0501234567",
    );
  });

  it("shows the no-service placeholder for the time field before a service is chosen", () => {
    render(<BookingForm action={noop()} services={SERVICES} />);
    expect(screen.getByText(BOOKINGS.form.noServiceForSlots)).toBeInTheDocument();
  });
});

describe("BookingForm — service selection + slots", () => {
  it("shows the service summary (duration + price) when a service is selected", async () => {
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);

    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");

    expect(screen.getByText(BOOKINGS.form.serviceSummaryDuration)).toBeInTheDocument();
    expect(screen.getByText(/180/)).toBeInTheDocument();
  });

  it("hides the price in the summary when the service price is zero", async () => {
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);
    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s2");
    expect(screen.queryByText(BOOKINGS.form.serviceSummaryPrice)).not.toBeInTheDocument();
  });

  it("loads and displays the available time slots after selecting a service", async () => {
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);

    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");

    await waitFor(() =>
      expect(screen.getByLabelText(BOOKINGS.form.startTimeLabel)).toBeInTheDocument(),
    );
    const select = screen.getByLabelText(
      BOOKINGS.form.startTimeLabel,
    ) as HTMLSelectElement;
    expect(within_options(select)).toContain("09:00");
    expect(within_options(select)).toContain("10:00");
    expect(fetch).toHaveBeenCalled();
  });

  it("shows the closed-day message when the business is closed that day", async () => {
    stubSlots({ open: false, slots: [] });
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);
    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");
    await waitFor(() =>
      expect(screen.getByText(BOOKINGS.form.closedDay)).toBeInTheDocument(),
    );
  });

  it("shows the no-slots message when the day is open but fully booked", async () => {
    stubSlots({ open: true, slots: [] });
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);
    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");
    await waitFor(() =>
      expect(screen.getByText(BOOKINGS.form.noSlots)).toBeInTheDocument(),
    );
  });

  it("shows the slots-error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })),
    );
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);
    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");
    await waitFor(() =>
      expect(screen.getByText(BOOKINGS.form.slotsError)).toBeInTheDocument(),
    );
  });
});

describe("BookingForm — submission + server state", () => {
  it("submits the typed values to the server action", async () => {
    const user = userEvent.setup();
    const action = vi.fn<
      (prev: BookingFormState, fd: FormData) => Promise<BookingFormState>
    >(async () => ({}));
    render(<BookingForm action={action} services={SERVICES} />);

    await user.type(screen.getByLabelText(BOOKINGS.form.clientNameLabel), "נועה");
    await user.type(screen.getByLabelText(BOOKINGS.form.phoneLabel), "0501234567");
    await user.selectOptions(screen.getByLabelText(BOOKINGS.form.serviceLabel), "s1");
    await waitFor(() =>
      expect(screen.getByLabelText(BOOKINGS.form.startTimeLabel)).toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: BOOKINGS.form.saveButton }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][1];
    expect(fd.get("clientName")).toBe("נועה");
    expect(fd.get("serviceId")).toBe("s1");
  });

  it("renders the form-level error and re-fills fields from server state", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async () =>
        ({
          formError: BOOKINGS.errors.generic,
          errors: { clientName: BOOKINGS.errors.clientNameRequired },
          values: { clientName: "חוזר מהשרת", phone: "0509999999" },
        }) as BookingFormState,
    );
    render(<BookingForm action={action} services={SERVICES} />);

    await user.click(
      screen.getByRole("button", { name: BOOKINGS.form.saveButton }),
    );

    await waitFor(() =>
      expect(screen.getByText(BOOKINGS.errors.generic)).toBeInTheDocument(),
    );
    expect(screen.getByText(BOOKINGS.errors.clientNameRequired)).toBeInTheDocument();
    expect((screen.getByLabelText(BOOKINGS.form.clientNameLabel) as HTMLInputElement).value).toBe(
      "חוזר מהשרת",
    );
  });

  it("clears slot state when the service is deselected", async () => {
    const user = userEvent.setup();
    render(<BookingForm action={noop()} services={SERVICES} />);
    const serviceSelect = screen.getByLabelText(BOOKINGS.form.serviceLabel);

    await user.selectOptions(serviceSelect, "s1");
    await waitFor(() =>
      expect(screen.getByLabelText(BOOKINGS.form.startTimeLabel)).toBeInTheDocument(),
    );

    await user.selectOptions(serviceSelect, "");
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(BOOKINGS.form.noServiceForSlots)).toBeInTheDocument();
  });
});

/** Read the text of all options in a <select>. */
function within_options(select: HTMLSelectElement): string[] {
  return Array.from(select.options).map((o) => o.textContent ?? "");
}
