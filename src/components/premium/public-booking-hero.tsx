import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PublicBookingHero — boutique customer-facing hero for the public booking
 * page. Taller editorial cover with a legibility scrim, a layered brand
 * medallion, name + tagline + rating, contact "aura" pills, and a trailing
 * slot for the booking card (sticky on desktop). Brand-color driven so each
 * business keeps its own accent.
 */
interface PublicBookingHeroProps {
  brand: string;
  name: string;
  tagline?: string | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  initials: string;
  rating?: React.ReactNode;
  /** contact pills row (address / phone / whatsapp / social) */
  contact?: React.ReactNode;
  /** booking card / form column (sticky on desktop) */
  bookingSlot?: React.ReactNode;
  /** desktop-only secondary cards rendered below the identity column */
  belowIdentity?: React.ReactNode;
  className?: string;
}

export function PublicBookingHero({
  brand,
  name,
  tagline,
  coverUrl,
  logoUrl,
  initials,
  rating,
  contact,
  bookingSlot,
  belowIdentity,
  className,
}: PublicBookingHeroProps) {
  return (
    <section dir="rtl" className={cn("relative", className)}>
      {/* ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem]"
        style={{
          background: `linear-gradient(180deg, ${brand}26 0%, ${brand}0d 46%, transparent 100%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10"
        style={{
          top: -40,
          insetInlineEnd: "8%",
          width: 360,
          height: 360,
          background: `radial-gradient(circle, ${brand}33 0%, transparent 65%)`,
          filter: "blur(50px)",
        }}
      />

      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 lg:pt-12",
          bookingSlot && "lg:grid lg:grid-cols-[1fr_minmax(420px,480px)] lg:items-start lg:gap-8",
        )}
      >
        {/* ── identity column ── */}
        <div className={bookingSlot ? "" : "lg:mx-auto lg:max-w-3xl"}>
          <div
            className="grain relative isolate overflow-hidden rounded-[1.75rem]"
            style={{ aspectRatio: "16 / 10", boxShadow: "0 28px 64px -26px rgba(60,20,45,0.5)" }}
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${brand} 0%, ${brand}cc 52%, #50163a 100%)` }}>
                <span className="absolute -bottom-6 left-4 select-none text-[11rem] font-black leading-none text-white/10" aria-hidden>
                  {initials}
                </span>
              </div>
            )}
            {/* legibility scrim */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(22,7,16,0.84) 0%, rgba(22,7,16,0.2) 44%, transparent 72%)" }}
            />

            <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-7">
              <span
                className="ring-soft flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white sm:h-[76px] sm:w-[76px]"
                style={{ background: `linear-gradient(135deg, ${brand}, #50163a)`, boxShadow: "0 14px 32px -8px rgba(0,0,0,0.55)" }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 flex-1 pb-1 text-white">
                <h1 className="display-num truncate text-2xl font-bold drop-shadow sm:text-[2rem]">{name}</h1>
                {tagline && <p className="mt-1.5 line-clamp-2 max-w-lg text-sm text-white/85 sm:text-[15px]">{tagline}</p>}
                {rating && <div className="mt-3">{rating}</div>}
              </div>
            </div>
          </div>

          {contact && <div className="mt-4 flex flex-wrap items-center gap-2">{contact}</div>}

          {belowIdentity && <div className="mt-5 hidden space-y-4 lg:block">{belowIdentity}</div>}
        </div>

        {/* ── booking column ── */}
        {bookingSlot && (
          <div id="book" tabIndex={-1} className="mt-8 scroll-mt-6 outline-none lg:mt-0 lg:sticky lg:top-6">
            {bookingSlot}
          </div>
        )}
      </div>
    </section>
  );
}
