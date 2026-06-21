// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicBookingHero } from "@/components/premium/public-booking-hero";

describe("PublicBookingHero", () => {
  it("renders name and initials fallback (no cover/logo)", () => {
    render(
      <PublicBookingHero brand="#b86b8c" name="סטודיו יופי" initials="סי" />,
    );
    expect(
      screen.getByRole("heading", { name: "סטודיו יופי" }),
    ).toBeInTheDocument();
    // initials appear in the watermark and the medallion fallback
    expect(screen.getAllByText("סי").length).toBeGreaterThan(0);
  });

  it("renders cover + logo images, tagline, rating, contact and booking slot", () => {
    render(
      <PublicBookingHero
        brand="#b86b8c"
        name="עסק"
        initials="ע"
        coverUrl="/cover.jpg"
        logoUrl="/logo.jpg"
        tagline="הטיפול המושלם"
        rating={<span>4.9★</span>}
        contact={<span>צור קשר</span>}
        bookingSlot={<div>קביעת תור</div>}
        belowIdentity={<div>מתחת לזהות</div>}
      />,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(2);
    expect(screen.getByText("הטיפול המושלם")).toBeInTheDocument();
    expect(screen.getByText("4.9★")).toBeInTheDocument();
    expect(screen.getByText("צור קשר")).toBeInTheDocument();
    expect(screen.getByText("קביעת תור")).toBeInTheDocument();
    expect(screen.getByText("מתחת לזהות")).toBeInTheDocument();
  });
});
