import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PublicBookingHero — a *compact* customer-facing business header for the public
 * booking page. Deliberately short so the booking wizard stays the primary
 * focus and is visible without scrolling:
 *   • real cover image → a slim editorial banner with a legibility scrim
 *   • no cover image    → a low brand-tinted band (NOT a giant empty gradient)
 * The logo medallion + name + tagline overlap the band, with a contact/rating
 * row underneath. It never owns the booking card — that lives in its own
 * dominant region below the header.
 */
interface PublicBookingHeroProps {
  brand: string;
  name: string;
  tagline?: string | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  initials: string;
  /** rating chip (rendered inline in the contact row) */
  rating?: React.ReactNode;
  /** contact pills row (address / phone / whatsapp / social) */
  contact?: React.ReactNode;
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
  className,
}: PublicBookingHeroProps) {
  return (
    <header dir="rtl" className={cn("relative", className)}>
      {/* subtle ambient brand wash at the very top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40"
        style={{
          background: `linear-gradient(180deg, ${brand}1f 0%, transparent 100%)`,
        }}
      />

      {coverUrl ? (
        // ── slim cover banner ──
        <div className="relative h-32 w-full overflow-hidden sm:h-44 lg:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(22,7,16,0.5) 0%, rgba(22,7,16,0.12) 50%, transparent 78%)",
            }}
          />
        </div>
      ) : (
        // ── compact brand band (no giant empty hero) ──
        <div
          className="h-16 w-full sm:h-20"
          style={{
            background: `linear-gradient(120deg, ${brand}2e 0%, ${brand}14 58%, transparent 100%)`,
          }}
        />
      )}

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="-mt-8 flex items-end gap-3.5 sm:-mt-11 sm:gap-4">
          <span
            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white ring-4 ring-white sm:h-[78px] sm:w-[78px]"
            style={{
              background: `linear-gradient(135deg, ${brand}, #50163a)`,
              boxShadow: "0 14px 32px -12px rgba(60,20,45,0.45)",
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display truncate text-[1.45rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {name}
            </h1>
            {tagline && (
              <p className="mt-0.5 line-clamp-1 text-sm text-[var(--muted)]">
                {tagline}
              </p>
            )}
          </div>
        </div>

        {(contact || rating) && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {rating}
            {contact}
          </div>
        )}
      </div>
    </header>
  );
}
