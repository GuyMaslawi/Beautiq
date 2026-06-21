// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";

import {
  BookingSelectionProvider,
  AppointmentSummary,
  useBookingSelection,
  type BookingSelection,
} from "@/app/b/[slug]/_components/booking-selection";

/** Seeds the shared context with a selection, then renders the summary. */
function Seed({ selection }: { selection: BookingSelection | null }) {
  const { setSelection } = useBookingSelection();
  useEffect(() => {
    if (selection) setSelection(selection);
  }, [selection, setSelection]);
  return null;
}

function renderWithSelection(
  selection: BookingSelection | null,
  props: Partial<Parameters<typeof AppointmentSummary>[0]> = {},
) {
  return render(
    <BookingSelectionProvider>
      <Seed selection={selection} />
      <AppointmentSummary brand="#b86b8c" {...props} />
    </BookingSelectionProvider>,
  );
}

describe("AppointmentSummary", () => {
  it("renders nothing when there is no active selection", () => {
    const { container } = renderWithSelection(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when active is false", () => {
    const { container } = renderWithSelection({
      serviceName: "מניקור",
      date: "2026-07-01",
      time: "09:00",
      active: false,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the service, date and time once active", () => {
    renderWithSelection({
      serviceName: "מניקור ג'ל",
      date: "2026-07-01",
      time: "09:00",
      active: true,
    });
    expect(screen.getByText("התור שלך")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("בשעה 09:00")).toBeInTheDocument();
  });

  it("shows the payment amount block when amountMinor > 0", () => {
    renderWithSelection({
      serviceName: "מניקור",
      date: "2026-07-01",
      time: "09:00",
      active: true,
      amountMinor: 15000,
      paymentKind: "full",
    });
    // 15000 agorot → ₪150
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it("renders the contact block with phone and address when provided", () => {
    renderWithSelection(
      {
        serviceName: "מניקור",
        date: "",
        time: "",
        active: true,
      },
      { businessPhone: "0501234567", addressLabel: "תל אביב" },
    );
    expect(screen.getByText("0501234567")).toBeInTheDocument();
    expect(screen.getByText("תל אביב")).toBeInTheDocument();
  });
});
