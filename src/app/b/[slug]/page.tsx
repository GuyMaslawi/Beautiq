import { MapPin, Phone, Star, Clock } from "lucide-react";
import { getPublicBusiness } from "@/server/public-booking/queries";
import { BookingRequestForm } from "./booking-request-form";
import { PublicReviewForm } from "./review-form";

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
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5" dir="ltr">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={sz}
          fill={i < rating ? "#f59e0b" : "none"}
          stroke={i < rating ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </div>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function normalizeInstagramUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("@")) return `https://instagram.com/${url.slice(1)}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

function normalizeSocialUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

function toWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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
      <main className="flex min-h-screen items-center justify-center p-6 bg-[#fafafa]">
        <div className="text-center space-y-3">
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

  const location = [business.city, business.area].filter(Boolean).join(", ");
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

  const waPhone = business.phone ? toWhatsAppPhone(business.phone) : null;
  const instagramHref = normalizeInstagramUrl(business.instagramUrl);
  const facebookHref = normalizeSocialUrl(business.facebookUrl);

  return (
    <main
      className="min-h-screen pb-20 lg:pb-0"
      style={{ background: "#f8f5f7" }}
      dir="rtl"
    >
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section>
        {/* ── Mobile cover (hidden on desktop) ── */}
        <div
          className="lg:hidden relative w-full overflow-hidden"
          style={{ height: "clamp(200px, 55vw, 300px)" }}
        >
          {business.coverImageUrl ? (
            <>
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
                    "linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0.22) 55%,rgba(0,0,0,0.65) 100%)",
                }}
              />
              <div className="absolute bottom-0 inset-x-0 px-5 pb-4">
                <h1
                  className="text-2xl font-bold text-white"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}
                >
                  {business.name}
                </h1>
                {avgRating !== null && (
                  <span
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold text-white"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(6px)" }}
                  >
                    <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
                    {avgRating.toFixed(1)}
                    <span className="font-normal opacity-75">· {business.reviews.length} ביקורות</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div
              className="h-full w-full"
              style={{ background: `linear-gradient(135deg, ${brand}1a 0%, ${brand}38 100%)` }}
            />
          )}
        </div>

        {/* ── Hero content wrapper ── */}
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          {/* Desktop 2-col hero */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:min-h-[440px] lg:py-12 lg:items-center">

            {/* ── Info column (right in RTL) ── */}
            <div
              className={
                business.coverImageUrl
                  ? "-mt-12 sm:-mt-14 lg:mt-0"
                  : "mt-6 lg:mt-0"
              }
            >
              {/* Logo row */}
              <div className="flex items-end justify-between gap-4">
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logoUrl}
                    alt={`לוגו ${business.name}`}
                    className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl border-4 border-white object-cover shadow-lg shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 lg:h-24 lg:w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-white shadow-lg text-3xl font-bold text-white"
                    style={{ background: brandGrd }}
                  >
                    {business.name.charAt(0)}
                  </div>
                )}

                {/* Desktop CTA beside logo */}
                {business.showServices && (
                  <a
                    href="#book"
                    className="hidden lg:flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-[.98]"
                    style={{ background: brandGrd }}
                  >
                    קבעי תור עכשיו ✨
                  </a>
                )}
              </div>

              {/* Name + rating (always visible on desktop; on mobile only when no cover) */}
              <div className={`mt-4 space-y-1.5 ${business.coverImageUrl ? "lg:block" : ""}`}>
                <h1 className={`text-2xl font-bold tracking-tight text-[var(--foreground)] ${business.coverImageUrl ? "hidden lg:block" : ""}`}>
                  {business.name}
                </h1>
                {avgRating !== null && (
                  <div className={`flex items-center gap-2 ${business.coverImageUrl ? "hidden lg:flex" : ""}`}>
                    <StarRow rating={Math.round(avgRating)} size="md" />
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {avgRating.toFixed(1)}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      · {business.reviews.length} ביקורות
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {(business.introMessage || business.description) && (
                <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed lg:max-w-md lg:text-base">
                  {business.introMessage ?? business.description}
                </p>
              )}

              {/* Contact chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {business.showAddress && (location || business.addressNote) && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {business.addressNote || location}
                  </span>
                )}
                {business.showPhone && business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--foreground)] transition-colors"
                    dir="ltr"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    {business.phone}
                  </a>
                )}
              </div>

              {/* Social icons row */}
              {(business.showPhone && waPhone || instagramHref || facebookHref) && (
                <div className="mt-3 flex items-center gap-2.5">
                  {business.showPhone && waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </a>
                  )}
                  {instagramHref && (
                    <a
                      href={instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] hover:border-pink-400 hover:text-pink-600 transition-colors"
                    >
                      <InstagramIcon className="h-4 w-4" />
                    </a>
                  )}
                  {facebookHref && (
                    <a
                      href={facebookHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <FacebookIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {/* Mobile primary CTA */}
              {business.showServices && (
                <a
                  href="#book"
                  className="mt-5 flex lg:hidden w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-[.98]"
                  style={{ background: brandGrd }}
                >
                  קבעי תור עכשיו
                </a>
              )}
            </div>

            {/* ── Visual column (left in RTL) — desktop only ── */}
            <div className="hidden lg:block lg:h-[400px] rounded-3xl overflow-hidden shrink-0">
              {business.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.coverImageUrl}
                  alt={business.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                /* No cover — elegant gradient panel */
                <div
                  className="h-full w-full flex flex-col items-center justify-center gap-4"
                  style={{
                    background: `linear-gradient(135deg, ${brand}18 0%, ${brand}30 50%, ${brand}18 100%)`,
                  }}
                >
                  <div
                    className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-white shadow-xl text-5xl font-black text-white"
                    style={{ background: brandGrd }}
                  >
                    {business.name.charAt(0)}
                  </div>
                  <p
                    className="text-xl font-bold text-center px-8"
                    style={{ color: brand }}
                  >
                    {business.name}
                  </p>
                  <p className="text-sm text-center px-10" style={{ color: `${brand}aa` }}>
                    קבעי תור בכמה צעדים פשוטים
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── REVIEWS ─────────────────────────────────────────────────────── */}
      {business.showReviews && business.reviews.length > 0 && avgRating !== null && (
        <section className="mt-8 lg:mt-10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
            {/* Summary bar */}
            <div
              className="flex items-center gap-4 rounded-2xl px-6 py-4 mb-5"
              style={{ background: `linear-gradient(135deg, ${brand}0d 0%, ${brand}1a 100%)` }}
            >
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold" style={{ color: brand }}>
                  {avgRating.toFixed(1)}
                </div>
                <StarRow rating={Math.round(avgRating)} size="md" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--foreground)] text-lg leading-tight">
                  {business.reviews.length} לקוחות מרוצות
                </div>
                <p className="text-sm text-[var(--muted)] mt-0.5">
                  מה שהלקוחות אומרות עלינו
                </p>
              </div>
            </div>

            {/* Review cards — 3-col on desktop */}
            <div className="overflow-x-auto lg:overflow-visible -mx-5 sm:mx-0 px-5 sm:px-0">
              <div className="flex gap-3 snap-x snap-mandatory pb-2 lg:grid lg:grid-cols-3 lg:snap-none lg:pb-0">
                {business.reviews.slice(0, 6).map((review) => (
                  <div
                    key={review.id}
                    className="w-72 shrink-0 snap-start rounded-2xl bg-white border border-[var(--border)] p-5 shadow-sm lg:w-auto"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: brandGrd }}
                        >
                          {review.clientName.charAt(0)}
                        </div>
                        <span className="font-semibold text-sm text-[var(--foreground)]">
                          {review.clientName}
                        </span>
                      </div>
                      <StarRow rating={review.rating} />
                    </div>
                    <p className="text-sm text-[var(--muted)] leading-relaxed">
                      &ldquo;{review.reviewText}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── SUBMIT REVIEW ───────────────────────────────────────────────── */}
      {business.showReviews && (
        <section className="mt-8 lg:mt-10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  השאירי ביקורת
                </h2>
                <p className="text-sm text-[var(--muted)] mt-0.5">
                  נשמח לשמוע על החוויה שלך 💬
                </p>
              </div>
              <div className="rounded-3xl bg-white border border-[var(--border)] p-6 shadow-sm">
                <PublicReviewForm slug={slug} brandColor={brand} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── GALLERY ─────────────────────────────────────────────────────── */}
      {business.showGallery && business.galleryImages.length > 0 && (
        <section className="mt-8 lg:mt-10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                גלריית עבודות
              </h2>
              <p className="text-sm text-[var(--muted)] mt-0.5">
                תמונות מהסטודיו שלנו
              </p>
            </div>
            <div className="overflow-x-auto lg:overflow-visible -mx-5 sm:mx-0 px-5 sm:px-0">
              <div className="flex gap-3 snap-x snap-mandatory pb-2 lg:grid lg:grid-cols-4 lg:snap-none lg:pb-0">
                {business.galleryImages.map((img) => (
                  <div
                    key={img.id}
                    className="w-48 h-48 shrink-0 snap-start overflow-hidden rounded-2xl shadow-sm lg:w-auto lg:h-auto lg:aspect-square"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt={img.caption ?? ""}
                      className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── BOOKING + HOURS (side-by-side on desktop) ───────────────────── */}
      <section className="mt-8 lg:mt-10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">

            {/* Booking form */}
            {business.showServices && business.services.length > 0 && (
              <div id="book" className="scroll-mt-6">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
                    style={{ background: brandGrd }}
                  >
                    📅
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--foreground)]">
                      קביעת תור
                    </h2>
                    <p className="text-xs text-[var(--muted)]">
                      כמה צעדים פשוטים ואת מוגדרת
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl bg-white border border-[var(--border)] p-6 shadow-sm">
                  <BookingRequestForm
                    slug={slug}
                    services={business.services}
                    cancellationPolicy={showPolicy ? policy : null}
                    showPrices={business.showPrices}
                    initialServiceId={initialServiceId}
                    businessName={business.name}
                    businessPhone={business.phone}
                    brandColor={brand}
                  />
                </div>
              </div>
            )}

            {/* Right sidebar: Hours + trust */}
            <div className="mt-8 lg:mt-0 space-y-4 lg:sticky lg:top-6">
              {/* Opening hours */}
              {business.showHours && business.availabilityDays.length > 0 && (
                <div className="rounded-2xl bg-white border border-[var(--border)] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 shrink-0" style={{ color: brand }} />
                    <h2 className="font-semibold text-sm text-[var(--foreground)]">
                      שעות פעילות
                    </h2>
                  </div>
                  <dl className="space-y-0 divide-y divide-[var(--border)]">
                    {business.availabilityDays.map((day) => (
                      <div
                        key={day.weekday}
                        className="flex justify-between py-2 text-sm"
                      >
                        <dt className="font-medium text-[var(--foreground)] text-xs">
                          יום {WEEKDAY_NAMES[day.weekday] ?? day.weekday}
                        </dt>
                        <dd className="text-[var(--muted)] text-xs" dir="ltr">
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

              {/* Trust card */}
              {business.showServices && (
                <div
                  className="rounded-2xl p-5 space-y-3"
                  style={{ background: `linear-gradient(135deg, ${brand}0d, ${brand}1e)` }}
                >
                  <p className="font-semibold text-sm" style={{ color: brand }}>
                    למה לקבוע אצלנו?
                  </p>
                  <ul className="space-y-2 text-xs text-[var(--muted)]">
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>קביעת תור מהירה ופשוטה</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>אישור תור אישי מהעסק</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>✅</span>
                      <span>שירות מקצועי ואיכותי</span>
                    </li>
                    {avgRating !== null && (
                      <li className="flex items-start gap-2">
                        <span>⭐</span>
                        <span>
                          דירוג {avgRating.toFixed(1)} מתוך {business.reviews.length} לקוחות
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* ─── MOBILE STICKY CTA ────────────────────────────────────────────── */}
      {business.showServices && business.services.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 lg:hidden z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-[#f8f5f7] to-transparent">
          <a
            href="#book"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: brandGrd }}
          >
            קבעי תור עכשיו ✨
          </a>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-14 pb-6 text-center">
        <p className="text-xs text-[var(--muted)]">
          מופעל על ידי{" "}
          <span className="font-semibold" style={{ color: brand }}>Beautiq</span>
        </p>
      </footer>
    </main>
  );
}
