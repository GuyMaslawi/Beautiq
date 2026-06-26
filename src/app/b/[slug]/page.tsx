import { ShieldCheck } from "lucide-react";
import { getPublicBusiness } from "@/server/public-booking/queries";
import { BookingRequestForm } from "./booking-request-form";
import { PublicReviewForm } from "./review-form";
import { PublicBusinessHeader } from "./_components/business-hero";
import { PublicReviewsSection } from "./_components/reviews-section";
import { PublicGallerySection } from "./_components/gallery-section";
import { PublicBusinessInfo } from "./_components/business-info";
import { PublicSiteFooter } from "./_components/site-footer";
import { StickyBookingCta } from "./_components/sticky-cta";
import { PublicBookingSecondary } from "./_components/booking-secondary";
import { BookingUnavailable } from "./_components/booking-empty";
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
  const brandGrd = `linear-gradient(135deg, ${brand}cc 0%, ${brand} 100%)`;

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

  // Optional sections only render with real data — never as big empty boxes.
  const showGallery =
    business.showGallery && business.galleryImages.length > 0;
  const showReviews =
    business.showReviews && business.reviews.length > 0 && avgRating !== null;

  return (
    <BookingSelectionProvider>
      <main
        className="app-ambient min-h-screen overflow-x-hidden pb-28 lg:pb-0"
        dir="rtl"
      >
        {/* 1 ─ Compact business header */}
        <PublicBusinessHeader
          business={business}
          brand={brand}
          avgRating={avgRating}
        />

        {/* 2 ─ Primary booking region (visible above the fold) */}
        <section className="mx-auto mt-6 w-full max-w-6xl px-5 sm:px-8 lg:mt-8">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
            {/* main column — the booking wizard (right side on desktop) */}
            <div id="book" tabIndex={-1} className="scroll-mt-6 outline-none">
              <div className="overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-white shadow-[0_24px_60px_-30px_rgba(124,58,97,0.34)]">
                <div
                  className="relative overflow-hidden px-6 pb-5 pt-6 text-center text-white"
                  style={{ background: brandGrd }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                  <h2 className="relative text-lg font-bold">
                    {hasBooking ? "קביעת תור" : "פרטי העסק"}
                  </h2>
                  {hasBooking && (
                    <p className="relative mt-1 inline-flex items-center gap-1.5 text-xs text-white/90">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      מהיר · נוח · ללא התחייבות
                    </p>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  {hasBooking ? (
                    <BookingRequestForm
                      slug={slug}
                      services={business.services}
                      showPrices={business.showPrices}
                      initialServiceId={initialServiceId}
                      businessName={business.name}
                      brandColor={brand}
                    />
                  ) : (
                    <BookingUnavailable
                      brand={brand}
                      phone={business.showPhone ? business.phone : null}
                      businessName={business.name}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* side column — desktop only, keeps the booking area balanced */}
            {hasBooking && (
              <aside className="mt-6 hidden space-y-4 lg:sticky lg:top-6 lg:mt-0 lg:block">
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
              </aside>
            )}
          </div>
        </section>

        {/* 3+ ─ Supporting sections, always below the booking flow */}
        <div className="mt-10 space-y-10 lg:mt-14 lg:space-y-14">
          {/* Business info — hours + contact */}
          <Reveal>
            <PublicBusinessInfo business={business} brand={brand} />
          </Reveal>

          {/* Gallery — only when real images exist */}
          {showGallery && (
            <Reveal>
              <PublicGallerySection
                images={business.galleryImages}
                brand={brand}
              />
            </Reveal>
          )}

          {/* Reviews — only when approved reviews exist */}
          {showReviews && (
            <Reveal>
              <PublicReviewsSection
                reviews={business.reviews}
                avgRating={avgRating}
                brand={brand}
              />
            </Reveal>
          )}

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
                      background:
                        "linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 100%)",
                      border: "1px solid rgba(255,255,255,0.7)",
                      boxShadow:
                        "0 16px 40px -20px rgba(124,58,97,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
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
