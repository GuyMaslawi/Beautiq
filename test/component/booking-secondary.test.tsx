// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PublicBookingSecondary } from "@/app/b/[slug]/_components/booking-secondary";

type Biz = Parameters<typeof PublicBookingSecondary>[0]["business"];

function renderCard(
  props: Partial<Parameters<typeof PublicBookingSecondary>[0]> = {},
) {
  const business: Biz = {
    phone: "050-1234567",
    showPhone: true,
    showAddress: true,
  };
  return render(
    <PublicBookingSecondary
      business={business}
      brand="#b86b8c"
      addressLabel="תל אביב, רחוב הרצל 1"
      {...props}
    />,
  );
}

describe("PublicBookingSecondary", () => {
  it("always renders the trust card with all trust points", () => {
    renderCard();
    expect(screen.getByText("למה לבחור בנו?")).toBeInTheDocument();
    expect(screen.getByText("שירות אישי ומותאם")).toBeInTheDocument();
    expect(screen.getByText("קביעת תור מהירה ונוחה")).toBeInTheDocument();
    expect(screen.getByText("אישור התור ישירות מול העסק")).toBeInTheDocument();
  });

  it("never renders a secure-payment row (payment removed from booking flow)", () => {
    renderCard();
    expect(screen.queryByText(/תשלום מאובטח/)).not.toBeInTheDocument();
  });

  it("renders the contact card with a tel: link and address when both shown", () => {
    renderCard();
    expect(screen.getByText("יצירת קשר")).toBeInTheDocument();
    const tel = screen.getByText("050-1234567").closest("a");
    expect(tel).toHaveAttribute("href", "tel:050-1234567");
    expect(screen.getByText("תל אביב, רחוב הרצל 1")).toBeInTheDocument();
  });

  it("omits the contact card entirely when there is nothing to show", () => {
    renderCard({
      business: { phone: null, showPhone: false, showAddress: false },
      addressLabel: null,
    });
    expect(screen.queryByText("יצירת קשר")).not.toBeInTheDocument();
  });

  it("shows the phone but not the address when address is hidden", () => {
    renderCard({
      business: { phone: "0500000000", showPhone: true, showAddress: false },
      addressLabel: "כתובת חסויה",
    });
    expect(screen.getByText("0500000000")).toBeInTheDocument();
    expect(screen.queryByText("כתובת חסויה")).not.toBeInTheDocument();
  });

  it("never renders a cancellation policy card (policy removed from booking flow)", () => {
    renderCard();
    expect(screen.queryByText("מדיניות ביטולים")).not.toBeInTheDocument();
  });
});
