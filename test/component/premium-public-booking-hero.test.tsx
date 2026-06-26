// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicBookingHero } from "@/components/premium/public-booking-hero";

describe("PublicBookingHero", () => {
  it("renders name and initials fallback (no cover/logo, no giant empty hero)", () => {
    const { container } = render(
      <PublicBookingHero brand="#b86b8c" name="סטודיו יופי" initials="סי" />,
    );
    expect(
      screen.getByRole("heading", { name: "סטודיו יופי" }),
    ).toBeInTheDocument();
    // initials appear in the medallion fallback
    expect(screen.getAllByText("סי").length).toBeGreaterThan(0);
    // compact header has no cover image when none is provided
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders cover + logo images, tagline, rating and contact (no booking slot)", () => {
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
      />,
    );
    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(2);
    expect(screen.getByText("הטיפול המושלם")).toBeInTheDocument();
    expect(screen.getByText("4.9★")).toBeInTheDocument();
    expect(screen.getByText("צור קשר")).toBeInTheDocument();
  });
});
