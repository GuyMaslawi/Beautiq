import { Link2, MapPin, Phone, Star, Clock } from "lucide-react";
import { getPublicBusiness } from "@/server/public-booking/queries";
import { BookingRequestForm } from "./booking-request-form";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-4 w-4"
          fill={i < rating ? "#b86b8c" : "none"}
          stroke={i < rating ? "#b86b8c" : "#ddd"}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {PUBLIC_BOOKING.notFound}
          </h1>
        </div>
      </main>
    );
  }

  const location = [business.city, business.area].filter(Boolean).join(", ");
  const policy = business.cancellationPolicy;
  const showPolicy = business.showCancellationPolicy && !!policy?.policyText;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }} dir="rtl">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Cover image */}
        {business.coverImageUrl ? (
          <div className="h-48 w-full overflow-hidden sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={business.coverImageUrl}
              alt={business.name}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(43,37,48,0.20) 0%, rgba(43,37,48,0.55) 100%)",
              }}
            />
          </div>
        ) : (
          <div
            className="h-36 w-full"
            style={{
              background:
                "linear-gradient(135deg, #f7eef3 0%, #f0e4ed 50%, #e8d6e5 100%)",
            }}
          />
        )}

        {/* Logo + name overlay */}
        <div
          className={`relative mx-auto max-w-lg px-4 ${
            business.coverImageUrl ? "-mt-14" : "-mt-10"
          }`}
        >
          <div className="flex items-end gap-4">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoUrl}
                alt={`לוגו ${business.name}`}
                className="h-20 w-20 rounded-2xl object-cover border-4 border-white shadow-md shrink-0"
              />
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white shadow-md text-2xl font-bold"
                style={{
                  background:
                    "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                  color: "white",
                }}
              >
                {business.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Business info ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-lg px-4 mt-4 space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          {business.name}
        </h1>

        {business.introMessage && (
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {business.introMessage}
          </p>
        )}

        {!business.introMessage && business.description && (
          <p className="text-sm text-[var(--muted)]">{business.description}</p>
        )}

        {/* Meta chips */}
        <div className="flex flex-wrap gap-3 pt-1">
          {business.showPhone && business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              dir="ltr"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {business.phone}
            </a>
          )}
          {business.showAddress && (location || business.addressNote) && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {business.addressNote || location}
            </span>
          )}
          {business.instagramUrl && (
            <a
              href={business.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              אינסטגרם
            </a>
          )}
        </div>
      </div>

      {/* ─── Main content ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-lg px-4 pb-16 pt-6 space-y-6">
        {/* Booking form */}
        {business.showServices && (
          <BookingRequestForm
            slug={slug}
            services={business.services}
            cancellationPolicy={showPolicy ? policy : null}
            showPrices={business.showPrices}
          />
        )}

        {/* Gallery */}
        {business.showGallery && business.galleryImages.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              גלריית עבודות
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {business.galleryImages.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-xl aspect-square"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageUrl}
                    alt={img.caption ?? ""}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {business.showReviews && business.reviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              מה לקוחות מספרות
            </h2>
            <div className="space-y-3">
              {business.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-[var(--border)] bg-white p-4 space-y-2"
                  style={{ boxShadow: "0 1px 4px rgba(43,37,48,0.05)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {review.clientName}
                    </span>
                    <StarRow rating={review.rating} />
                  </div>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {review.reviewText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business hours */}
        {business.showHours && business.availabilityDays.length > 0 && (
          <div
            className="rounded-2xl border border-[var(--border)] bg-white p-5 space-y-3"
            style={{ boxShadow: "0 1px 4px rgba(43,37,48,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" style={{ color: "#b86b8c" }} />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                שעות פעילות
              </h2>
            </div>
            <dl className="space-y-2">
              {business.availabilityDays.map((day) => (
                <div key={day.weekday} className="flex justify-between text-sm">
                  <dt className="text-[var(--foreground)] font-medium">
                    יום {WEEKDAY_NAMES[day.weekday] ?? day.weekday}
                  </dt>
                  <dd className="text-[var(--muted)]" dir="ltr">
                    {day.windows
                      .map(
                        (w) =>
                          `${minutesToTime(w.startMinutes)}–${minutesToTime(w.endMinutes)}`,
                      )
                      .join(", ")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}
