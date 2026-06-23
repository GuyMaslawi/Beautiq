import { getPublicBusiness } from "@/server/public-booking/queries";
import { BookingRequestForm } from "./booking-request-form";
import { PublicReviewForm } from "./review-form";
import { PublicBusinessHero } from "./_components/business-hero";
import { PublicTrustSection } from "./_components/trust-section";
import { PublicReviewsSection } from "./_components/reviews-section";
import { PublicGallerySection } from "./_components/gallery-section";
import { PublicBusinessInfo } from "./_components/business-info";
import { PublicSiteFooter } from "./_components/site-footer";
import { StickyBookingCta } from "./_components/sticky-cta";
import { PublicBookingSecondary } from "./_components/booking-secondary";
import {
  BookingSelectionProvider,
  AppointmentSummary,
} from "./_components/booking-selection";
import { Reveal } from "@/components/ui/animate";

export default async function PublicBusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const initialServiceId = typeof sp.s === "string" ? sp.s : "";

  const business = await getPublicBusiness(slug);

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
        <div className="space-y-3 text-center">
          <div className="text-5xl">🌸</div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            הקישור לא נמצא
          </h1>
        </div>
      </main>
    );
  }

  const brand = business.brandColor ?? "#b86b8c";

  const avgRating =
    business.reviews.length > 0
      ? Math.round(
          (business.reviews.reduce((s, r) => s + r.rating, 0) /
            business.reviews.length) *
            10,
        ) / 10
      : null;

  const hasBooking = business.showServices && business.services.length > 0;

  const location = [business.city, business.area].filter(Boolean).join(", ");
  const addressLabel = business.addressNote || location || null;

  const bookingForm = hasBooking ? (
    <BookingRequestForm
      slug={slug}
      services={business.services}
      showPrices={business.showPrices}
      initialServiceId={initialServiceId}
      businessName={business.name}
      brandColor={brand}
    />
  ) : null;

  // Right-column secondary content (desktop) — keeps the booking area cohesive.
  const secondaryContent = hasBooking ? (
    <>
      <AppointmentSummary
        brand={brand}
        businessPhone={business.showPhone ? business.phone : null}
        addressLabel={business.showAddress ? addressLabel : null}
      />
      <PublicBookingSecondary
        business={business}
        brand={brand}
        addressLabel={business.showAddress ? addressLabel : null}
      />
    </>
  ) : undefined;

  return (
    <BookingSelectionProvider>
      <main
        className="app-ambient min-h-screen overflow-x-hidden pb-28 lg:pb-0"
        dir="rtl"
      >
        <PublicBusinessHero
          business={business}
          brand={brand}
          avgRating={avgRating}
          bookingForm={bookingForm}
          secondaryContent={secondaryContent}
        />

        <div className="mt-9 space-y-9 lg:mt-12 lg:space-y-12">
        {hasBooking && (
          <Reveal>
            <PublicTrustSection brand={brand} />
          </Reveal>
        )}

        {business.showReviews &&
          business.reviews.length > 0 &&
          avgRating !== null && (
            <Reveal>
              <PublicReviewsSection
                reviews={business.reviews}
                avgRating={avgRating}
                brand={brand}
              />
            </Reveal>
          )}

        {business.showGallery && (
          <Reveal>
            <PublicGallerySection images={business.galleryImages} brand={brand} />
          </Reveal>
        )}

        <Reveal>
          <PublicBusinessInfo business={business} brand={brand} />
        </Reveal>

        {/* Leave a review */}
        {business.showReviews && (
          <Reveal>
            <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
              <div className="mx-auto max-w-2xl">
                <div className="mb-4 text-center">
                  <span className="eyebrow" style={{ color: brand }}>
                    שיתוף חוויה
                  </span>
                  <h2 className="text-foreground mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
                    כתבי לנו ביקורת
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    נשמח לשמוע על החוויה שלך 💬
                  </p>
                </div>
                <div
                  className="rounded-[1.6rem] p-6 sm:p-7"
                  style={{
                    background: "linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 100%)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    boxShadow: "0 16px 40px -20px rgba(124,58,97,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  <PublicReviewForm slug={slug} brandColor={brand} />
                </div>
              </div>
            </section>
          </Reveal>
        )}
      </div>

      <PublicSiteFooter business={business} />

        {/* Mobile sticky booking CTA */}
        {hasBooking && (
          <StickyBookingCta
            brand={brand}
            businessPhone={business.showPhone ? business.phone : null}
            businessName={business.name}
          />
        )}
      </main>
    </BookingSelectionProvider>
  );
}
