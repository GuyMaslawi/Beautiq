// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PublicGallerySection } from "@/app/b/[slug]/_components/gallery-section";
import { PublicReviewsSection } from "@/app/b/[slug]/_components/reviews-section";
import { PublicSiteFooter } from "@/app/b/[slug]/_components/site-footer";
import { PublicTrustSection } from "@/app/b/[slug]/_components/trust-section";
import { PublicBusinessInfo } from "@/app/b/[slug]/_components/business-info";
import { PublicBusinessHeader } from "@/app/b/[slug]/_components/business-hero";
import type {
  PublicBusiness,
  PublicGalleryImage,
  PublicReview,
} from "@/server/public-booking/queries";

const BRAND = "#b86b8c";

function makePublicBusiness(
  overrides: Partial<PublicBusiness> = {},
): PublicBusiness {
  return {
    id: "biz-1",
    name: "סטודיו יופי",
    description: "מספרה ומכון יופי",
    city: "תל אביב",
    area: "מרכז",
    addressNote: null,
    phone: "050-1234567",
    instagramUrl: null,
    facebookUrl: null,
    brandColor: BRAND,
    introMessage: null,
    slug: "studio-yofi",
    logoUrl: null,
    coverImageUrl: null,
    showServices: true,
    showPrices: true,
    showHours: true,
    showReviews: true,
    showGallery: true,
    showPhone: true,
    showAddress: true,
    services: [],
    galleryImages: [],
    reviews: [],
    availabilityDays: [],
    ...overrides,
  };
}

const REVIEWS: PublicReview[] = [
  { id: "r1", clientName: "דנה", reviewText: "מעולה!", rating: 5 },
  { id: "r2", clientName: "מיכל", reviewText: "שירות נהדר", rating: 4 },
];

describe("PublicGallerySection", () => {
  it("renders nothing when there are no images (no giant empty placeholder)", () => {
    const { container } = render(
      <PublicGallerySection images={[]} brand={BRAND} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("בקרוב יעלו עבודות לגלריה")).not.toBeInTheDocument();
    expect(screen.queryByText("העבודות שלנו")).not.toBeInTheDocument();
  });

  it("renders an image grid when images exist (caption falls back to empty alt)", () => {
    const images: PublicGalleryImage[] = [
      { id: "g1", imageUrl: "https://x/1.jpg", caption: "עבודה 1" },
      { id: "g2", imageUrl: "https://x/2.jpg", caption: null },
    ];
    const { container } = render(
      <PublicGallerySection images={images} brand={BRAND} />,
    );
    // Query by tag — an empty alt makes the second image presentational (no img role).
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("alt", "עבודה 1");
    // null caption must not leak "null" into the alt.
    expect(imgs[1]).toHaveAttribute("alt", "");
  });
});

describe("PublicReviewsSection", () => {
  it("renders review text, names and average rating safely", () => {
    render(<PublicReviewsSection reviews={REVIEWS} avgRating={4.5} brand={BRAND} />);
    expect(screen.getByText("מה הלקוחות אומרות")).toBeInTheDocument();
    expect(screen.getByText("מעולה!")).toBeInTheDocument();
    expect(screen.getByText("דנה")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText(/מבוסס על 2 ביקורות/)).toBeInTheDocument();
  });

  it("caps the rendered cards at 6", () => {
    const many: PublicReview[] = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      clientName: `לקוחה ${i}`,
      reviewText: `ביקורת ${i}`,
      rating: 5,
    }));
    render(<PublicReviewsSection reviews={many} avgRating={5} brand={BRAND} />);
    // Only the first 6 review texts should be present.
    expect(screen.getByText("ביקורת 5")).toBeInTheDocument();
    expect(screen.queryByText("ביקורת 6")).not.toBeInTheDocument();
  });
});

describe("PublicSiteFooter", () => {
  it('always renders the "Powered by Allura" footer credit', () => {
    render(<PublicSiteFooter business={makePublicBusiness()} />);
    expect(screen.getByText("Allura")).toBeInTheDocument();
    expect(screen.getByText(/כל הזכויות שמורות/)).toBeInTheDocument();
  });

  it("renders social links only when their values exist", () => {
    render(
      <PublicSiteFooter
        business={makePublicBusiness({
          instagramUrl: "@studio",
          facebookUrl: null,
          phone: null,
        })}
      />,
    );
    expect(screen.getByLabelText("Instagram")).toBeInTheDocument();
    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp")).not.toBeInTheDocument();
  });

  it("hides the WhatsApp link when showPhone is false even if a phone exists", () => {
    render(
      <PublicSiteFooter
        business={makePublicBusiness({
          phone: "050-1234567",
          showPhone: false,
          instagramUrl: null,
          facebookUrl: null,
        })}
      />,
    );
    expect(screen.queryByLabelText("WhatsApp")).not.toBeInTheDocument();
  });
});

describe("PublicTrustSection", () => {
  it("renders the four static Hebrew benefit cards", () => {
    render(<PublicTrustSection brand={BRAND} />);
    expect(screen.getByText("למה לבחור בנו?")).toBeInTheDocument();
    expect(screen.getByText("שירות אישי ומותאם")).toBeInTheDocument();
    expect(screen.getByText("אווירה נעימה ומפנקת")).toBeInTheDocument();
  });
});

describe("PublicBusinessInfo", () => {
  it("returns null when there is nothing to show", () => {
    const { container } = render(
      <PublicBusinessInfo
        business={makePublicBusiness({
          showHours: false,
          showAddress: false,
          showPhone: false,
          availabilityDays: [],
        })}
        brand={BRAND}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders opening hours when available", () => {
    render(
      <PublicBusinessInfo
        business={makePublicBusiness({
          availabilityDays: [
            { weekday: 0, windows: [{ startMinutes: 540, endMinutes: 1020 }] },
          ],
        })}
        brand={BRAND}
      />,
    );
    expect(screen.getByText("שעות פעילות")).toBeInTheDocument();
    expect(screen.getByText("יום ראשון")).toBeInTheDocument();
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
  });
});

describe("PublicBusinessHeader", () => {
  it("renders the business name and tagline (compact, no booking card inside)", () => {
    render(
      <PublicBusinessHeader
        business={makePublicBusiness({ introMessage: "ברוכה הבאה" })}
        brand={BRAND}
        avgRating={4.5}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "סטודיו יופי" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ברוכה הבאה")).toBeInTheDocument();
    // The header no longer owns the booking card — that lives in its own region.
    expect(screen.queryByText("קביעת תור ב־3 צעדים")).not.toBeInTheDocument();
  });

  it("does not render a cover image when the business has no cover (no giant empty hero)", () => {
    const { container } = render(
      <PublicBusinessHeader
        business={makePublicBusiness({ coverImageUrl: null, logoUrl: null })}
        brand={BRAND}
        avgRating={null}
      />,
    );
    // No <img> at all when there's neither a cover nor a logo — just initials.
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the cover image when one is provided", () => {
    const { container } = render(
      <PublicBusinessHeader
        business={makePublicBusiness({ coverImageUrl: "https://x/cover.jpg" })}
        brand={BRAND}
        avgRating={null}
      />,
    );
    const cover = container.querySelector('img[src="https://x/cover.jpg"]');
    expect(cover).not.toBeNull();
  });

  it("shows the rating badge only when avgRating is provided", () => {
    const { rerender } = render(
      <PublicBusinessHeader
        business={makePublicBusiness({ reviews: REVIEWS })}
        brand={BRAND}
        avgRating={4.5}
      />,
    );
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText(/2 ביקורות/)).toBeInTheDocument();

    rerender(
      <PublicBusinessHeader
        business={makePublicBusiness()}
        brand={BRAND}
        avgRating={null}
      />,
    );
    expect(screen.queryByText("4.5")).not.toBeInTheDocument();
  });

  it("renders social/contact buttons only when their values exist", () => {
    render(
      <PublicBusinessHeader
        business={makePublicBusiness({
          instagramUrl: "@studio",
          facebookUrl: null,
          phone: "050-1234567",
        })}
        brand={BRAND}
        avgRating={null}
      />,
    );
    expect(screen.getByLabelText("Instagram")).toBeInTheDocument();
    expect(screen.queryByLabelText("Facebook")).not.toBeInTheDocument();
    // WhatsApp icon link present because phone + showPhone.
    expect(screen.getByLabelText("WhatsApp")).toBeInTheDocument();
  });

  it("does not leak null/undefined into the rendered header", () => {
    const { container } = render(
      <PublicBusinessHeader
        business={makePublicBusiness({
          description: null,
          introMessage: null,
          area: null,
        })}
        brand={BRAND}
        avgRating={null}
      />,
    );
    expect(container.textContent ?? "").not.toMatch(/undefined|null|NaN/);
  });
});
