// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PublicBookingSuccessView } from "@/app/b/[slug]/_components/booking-success";
import type { PublicBookingSuccess } from "@/server/payments/booking-success";

const BRAND = "#b86b8c";

function makeState(
  overrides: Partial<PublicBookingSuccess> = {},
): PublicBookingSuccess {
  return {
    businessName: "סטודיו יופי",
    businessPhone: "0501234567",
    serviceName: "מניקור ג'ל",
    date: "2026-06-15",
    time: "10:30",
    durationMinutes: 60,
    customerName: "נועה כהן",
    customerPhone: "0509876543",
    payment: "paid",
    ...overrides,
  };
}

function renderView(state: PublicBookingSuccess, token = "bp_1") {
  return render(
    <PublicBookingSuccessView
      slug="studio-yofi"
      token={token}
      state={state}
      brand={BRAND}
    />,
  );
}

describe("PublicBookingSuccessView — paid", () => {
  it("shows the paid title, confirmation and booking details", () => {
    renderView(makeState({ payment: "paid" }));
    expect(screen.getByText("התשלום התקבל והתור נקבע")).toBeInTheDocument();
    expect(screen.getByText("תודה! פרטי התור נשלחו לעסק.")).toBeInTheDocument();
    expect(screen.getByText("מניקור ג'ל")).toBeInTheDocument();
    expect(screen.getByText("נועה כהן")).toBeInTheDocument();
    expect(screen.getByText("0509876543")).toBeInTheDocument();
    // Paid status badge
    expect(screen.getByText("שולם")).toBeInTheDocument();
  });

  it("includes a calendar link and a prefilled WhatsApp link to the business", () => {
    const { container } = renderView(makeState({ payment: "paid" }));
    const links = Array.from(container.querySelectorAll("a")).map(
      (a) => a.getAttribute("href") ?? "",
    );

    const cal = links.find((h) => h.includes("calendar.google.com"));
    expect(cal).toBeTruthy();
    expect(cal).toContain("20260615T1030");

    const wa = links.find((h) => h.startsWith("https://wa.me/"));
    expect(wa).toBeTruthy();
    // Israeli phone normalized to wa.me digits.
    expect(wa).toContain("wa.me/972501234567");
    // Prefilled Hebrew message includes the service + business name.
    expect(decodeURIComponent(wa!)).toContain("מניקור ג'ל");
    expect(decodeURIComponent(wa!)).toContain("סטודיו יופי");
  });

  it("shows the friendly save note and a back-to-business link", () => {
    renderView(makeState({ payment: "paid" }));
    expect(
      screen.getByText("מומלץ לשמור את פרטי התור ביומן."),
    ).toBeInTheDocument();
    const back = screen.getByText("חזרה לעמוד העסק").closest("a");
    expect(back).toHaveAttribute("href", "/b/studio-yofi");
  });

  it("does not leak null/undefined/internal data", () => {
    const { container } = renderView(makeState({ payment: "paid" }));
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/undefined|null|NaN|businessId|bp_1/i);
  });
});

describe("PublicBookingSuccessView — pay at business", () => {
  it("labels the payment as pay-at-business and uses the booked title", () => {
    renderView(makeState({ payment: "pay_at_business" }));
    expect(screen.getByText("התור נקבע בהצלחה")).toBeInTheDocument();
    expect(screen.getByText("תשלום במקום")).toBeInTheDocument();
  });
});

describe("PublicBookingSuccessView — pending", () => {
  it("shows the still-verifying state with a refresh that keeps the token", () => {
    const { container } = renderView(makeState({ payment: "pending" }), "bp_42");
    expect(screen.getByText("התשלום עדיין בבדיקה")).toBeInTheDocument();
    // No customer details exposed in the pending shell.
    expect(screen.queryByText("נועה כהן")).not.toBeInTheDocument();

    const refresh = screen.getByText("רענון הסטטוס").closest("a");
    expect(refresh).toHaveAttribute(
      "href",
      "/b/studio-yofi?bookingSuccess=bp_42",
    );
    // A back link is still offered.
    expect(screen.getByText("חזרה לעמוד העסק")).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/undefined|null/);
  });
});

describe("PublicBookingSuccessView — failed", () => {
  it("shows the not-completed state with a way back", () => {
    renderView(makeState({ payment: "failed" }));
    expect(screen.getByText("התשלום לא הושלם")).toBeInTheDocument();
    const retry = screen.getByText("חזרה לעמוד העסק").closest("a");
    expect(retry).toHaveAttribute("href", "/b/studio-yofi");
  });
});
