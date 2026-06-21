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
  /** booking card / form column */
  bookingSlot?: React.ReactNode;
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
  className,
}: PublicBookingHeroProps) {
  return (
    <section dir="rtl" className={cn("relative", className)}>
      {/* ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]"
        style={{ background: `radial-gradient(60rem 30rem at 80% -10%, ${brand}22, transparent 60%)` }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-6 px-5 pt-5 sm:px-8 lg:grid-cols-[1fr_minmax(400px,460px)] lg:gap-8">
        {/* ── editorial cover + identity ── */}
        <div>
          <div
            className="grain relative isolate overflow-hidden rounded-[1.75rem]"
            style={{ aspectRatio: "16 / 10", boxShadow: "0 24px 60px -24px rgba(60,20,45,0.45)" }}
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${brand} 0%, ${brand}cc 55%, #50163a 100%)` }} />
            )}
            {/* legibility scrim */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(25,8,18,0.82) 0%, rgba(25,8,18,0.18) 42%, transparent 70%)" }}
            />

            <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-7">
              <span
                className="ring-soft flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white sm:h-20 sm:w-20"
                style={{ background: `linear-gradient(135deg, ${brand}, #50163a)`, boxShadow: "0 12px 30px -8px rgba(0,0,0,0.5)" }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 flex-1 pb-1 text-white">
                <h1 className="display-num truncate text-2xl font-bold drop-shadow sm:text-[1.85rem]">{name}</h1>
                {tagline && <p className="mt-1 line-clamp-2 text-sm text-white/85">{tagline}</p>}
              </div>
              {rating && <div className="shrink-0 pb-1">{rating}</div>}
            </div>
          </div>

          {contact && <div className="mt-4 flex flex-wrap gap-2">{contact}</div>}

          {/* desktop secondary slot lives below in page; mobile booking card follows */}
        </div>

        {/* ── booking column ── */}
        {bookingSlot && <div className="lg:sticky lg:top-6 lg:self-start">{bookingSlot}</div>}
      </div>
    </section>
  );
}
