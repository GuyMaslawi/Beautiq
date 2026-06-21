import { getPublicBusiness } from "@/server/public-booking/queries";
import { getPublicPaymentPolicy } from "@/server/payments/settings";
import { getPublicBookingSuccess } from "@/server/payments/booking-success";
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
import { PublicBookingSuccessView } from "./_components/booking-success";
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
  const successToken =
    typeof sp.bookingSuccess === "string" ? sp.bookingSuccess : "";

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

  const policy = business.cancellationPolicy;
  const showPolicy = business.showCancellationPolicy && !!policy?.policyText;

  const avgRating =
    business.reviews.length > 0
      ? Math.round(
          (business.reviews.reduce((s, r) => s + r.rating, 0) /
            business.reviews.length) *
            10,
        ) / 10
      : null;

  const hasBooking = business.showServices && business.services.length > 0;

  // Public-safe payment policy (never includes credentials). Drives the
  // optional secure-payment step in the booking form.
  const paymentPolicy = await getPublicPaymentPolicy(business.id);
  const requiresPayment = !!paymentPolicy && paymentPolicy.requirement !== "none";

  const location = [business.city, business.area].filter(Boolean).join(", ");
  const addressLabel = business.addressNote || location || null;

  // Post-payment return: when arriving with a valid bookingSuccess token, show
  // the full booking confirmation in the booking column instead of the form.
  // The payment state is read from the authoritative DB record (webhook-driven),
  // never from the query param itself.
  const successState = successToken
    ? await getPublicBookingSuccess(slug, successToken)
    : null;

  const bookingForm =
    hasBooking && successState ? (
      <PublicBookingSuccessView
        slug={slug}
        token={successToken}
        state={successState}
        brand={brand}
      />
    ) : hasBooking ? (
      <BookingRequestForm
        slug={slug}
        services={business.services}
        cancellationPolicy={showPolicy ? policy : null}
        showPrices={business.showPrices}
        initialServiceId={initialServiceId}
        businessName={business.name}
        businessPhone={business.phone}
        brandColor={brand}
        paymentPolicy={
          paymentPolicy
            ? {
                requirement: paymentPolicy.requirement,
                allowPayAtBusiness: paymentPolicy.allowPayAtBusiness,
                instructions: paymentPolicy.instructions,
              }
            : null
        }
      />
    ) : null;

  // Right-column secondary content (desktop) — keeps the booking area cohesive.
  // Skipped on the success screen so the confirmation stands on its own.
  const secondaryContent =
    hasBooking && !successState ? (
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
          policyText={showPolicy ? (policy?.policyText ?? null) : null}
          requiresPayment={requiresPayment}
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
          hideBookingHeader={!!successState}
        />

        <div className="mt-10 space-y-10 lg:mt-14 lg:space-y-14">
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
          <PublicBusinessInfo
            business={business}
            brand={brand}
            policyText={showPolicy ? (policy?.policyText ?? null) : null}
          />
        </Reveal>

        {/* Leave a review */}
        {business.showReviews && (
          <Reveal>
            <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
              <div className="mx-auto max-w-2xl">
                <div className="mb-4 text-center">
                  <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">
                    כתבי לנו ביקורת
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    נשמח לשמוע על החוויה שלך 💬
                  </p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-7">
                  <PublicReviewForm slug={slug} brandColor={brand} />
                </div>
              </div>
            </section>
          </Reveal>
        )}
      </div>

      <PublicSiteFooter business={business} />

        {/* Mobile sticky booking CTA */}
        {hasBooking && !successState && <StickyBookingCta brand={brand} />}
      </main>
    </BookingSelectionProvider>
  );
}
