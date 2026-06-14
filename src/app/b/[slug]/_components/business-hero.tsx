import type { ReactNode } from "react";
import { MapPin, Phone, Navigation, ShieldCheck } from "lucide-react";
import type { PublicBusiness } from "@/server/public-booking/queries";
import { StarRow, InstagramIcon, FacebookIcon, WhatsAppIcon } from "./icons";
import {
  brandGradient,
  normalizeInstagramUrl,
  normalizeSocialUrl,
  toWhatsAppPhone,
  mapsSearchUrl,
} from "./helpers";

export function PublicBusinessHero({
  business,
  brand,
  avgRating,
  bookingForm,
}: {
  business: PublicBusiness;
  brand: string;
  avgRating: number | null;
  bookingForm: ReactNode;
}) {
  const grd = brandGradient(brand);
  const location = [business.city, business.area].filter(Boolean).join(", ");
  const addressLabel = business.addressNote || location;
  const mapQuery = [business.name, location].filter(Boolean).join(", ");

  const waPhone = business.phone ? toWhatsAppPhone(business.phone) : null;
  const instagramHref = normalizeInstagramUrl(business.instagramUrl);
  const facebookHref = normalizeSocialUrl(business.facebookUrl);
  const tagline = business.introMessage ?? business.description;

  const hasContactRow =
    (business.showAddress && !!addressLabel) ||
    (business.showPhone && !!business.phone) ||
    (business.showPhone && !!waPhone) ||
    !!instagramHref ||
    !!facebookHref;

  return (
    <section className="relative">
      {/* soft brand wash sitting behind BOTH columns to tie them into one hero */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[340px] sm:h-[400px] lg:h-[470px]"
        style={{
          background: `linear-gradient(180deg, ${brand}1f 0%, ${brand}0a 45%, ${brand}00 100%)`,
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div
          className={`pt-6 lg:pt-12 ${
            bookingForm
              ? "lg:grid lg:grid-cols-[1fr_minmax(360px,390px)] lg:gap-8 lg:items-start"
              : ""
          }`}
        >
          {/* ── Identity column (right in RTL) ── */}
          <div className={bookingForm ? "" : "lg:mx-auto lg:max-w-3xl"}>
            {/* Cover / brand panel */}
            <div className="relative h-[260px] overflow-hidden rounded-3xl shadow-lg sm:h-[330px] lg:h-[400px]">
              {business.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.coverImageUrl}
                  alt={business.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${brand} 0%, ${brand}cc 55%, ${brand}99 100%)`,
                  }}
                >
                  <span
                    className="absolute -bottom-6 left-4 select-none text-[10rem] font-black leading-none text-white/10"
                    aria-hidden="true"
                  >
                    {business.name.charAt(0)}
                  </span>
                </div>
              )}

              {/* legibility overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.62) 100%)",
                }}
              />

              {/* Logo badge */}
              <div className="absolute right-5 top-5">
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logoUrl}
                    alt={`לוגו ${business.name}`}
                    className="h-16 w-16 rounded-2xl border-[3px] border-white object-cover shadow-lg sm:h-[72px] sm:w-[72px]"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-white text-2xl font-bold text-white shadow-lg sm:h-[72px] sm:w-[72px]"
                    style={{ background: grd }}
                  >
                    {business.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Bottom content */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <h1
                  className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
                >
                  {business.name}
                </h1>
                {tagline && (
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/90 sm:text-base">
                    {tagline}
                  </p>
                )}
                {avgRating !== null && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm backdrop-blur">
                    <StarRow rating={Math.round(avgRating)} size="sm" />
                    <span className="text-sm font-bold text-[var(--foreground)]">
                      {avgRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      ({business.reviews.length} ביקורות)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact + social row */}
            {hasContactRow && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {business.showAddress && addressLabel && (
                  <a
                    href={mapsSearchUrl(mapQuery)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
                    {addressLabel}
                    <Navigation className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                )}
                {business.showPhone && business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    dir="ltr"
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
                    {business.phone}
                  </a>
                )}

                <div className="flex items-center gap-2">
                  {business.showPhone && waPhone && (
                    <a
                      href={`https://wa.me/${waPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition-opacity hover:opacity-90"
                    >
                      <WhatsAppIcon className="h-[18px] w-[18px]" />
                    </a>
                  )}
                  {instagramHref && (
                    <a
                      href={instagramHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition-colors hover:border-pink-300 hover:text-pink-600"
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
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--muted)] transition-colors hover:border-blue-300 hover:text-blue-600"
                    >
                      <FacebookIcon className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Booking column (left in RTL) ── */}
          {bookingForm && (
            <div
              id="book"
              tabIndex={-1}
              className="mt-8 scroll-mt-6 outline-none lg:mt-0 lg:sticky lg:top-6"
            >
              <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-lg">
                {/* Card header */}
                <div
                  className="px-6 pt-6 pb-5 text-center text-white"
                  style={{ background: grd }}
                >
                  <h2 className="text-lg font-bold">קביעת תור ב־3 צעדים</h2>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/90">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    מאובטח · מהיר · ללא התחייבות
                  </p>
                </div>
                <div className="p-5 sm:p-6">{bookingForm}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
