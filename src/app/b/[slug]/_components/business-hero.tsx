import type { ReactNode } from "react";
import { MapPin, Phone, Navigation, ShieldCheck } from "lucide-react";
import type { PublicBusiness } from "@/server/public-booking/queries";
import { PublicBookingHero } from "@/components/premium/public-booking-hero";
import { StarRow, InstagramIcon, FacebookIcon, WhatsAppIcon } from "./icons";
import {
  brandGradient,
  normalizeInstagramUrl,
  normalizeSocialUrl,
  getBusinessWhatsAppHref,
  mapsSearchUrl,
} from "./helpers";

export function PublicBusinessHero({
  business,
  brand,
  avgRating,
  bookingForm,
  secondaryContent,
  hideBookingHeader = false,
}: {
  business: PublicBusiness;
  brand: string;
  avgRating: number | null;
  bookingForm: ReactNode;
  /** Desktop-only cards rendered under the hero in the right column. */
  secondaryContent?: ReactNode;
  /** Hide the "קביעת תור ב־3 צעדים" card header (e.g. for the success view). */
  hideBookingHeader?: boolean;
}) {
  const grd = brandGradient(brand);
  const location = [business.city, business.area].filter(Boolean).join(", ");
  const addressLabel = business.addressNote || location;
  const mapQuery = [business.name, location].filter(Boolean).join(", ");

  const waHref = business.showPhone
    ? getBusinessWhatsAppHref(business.phone, business.name)
    : null;
  const instagramHref = normalizeInstagramUrl(business.instagramUrl);
  const facebookHref = normalizeSocialUrl(business.facebookUrl);
  const tagline = business.introMessage ?? business.description;

  const hasContactRow =
    (business.showAddress && !!addressLabel) ||
    (business.showPhone && !!business.phone) ||
    !!waHref ||
    !!instagramHref ||
    !!facebookHref;

  // ── rating chip (overlaid on the cover) ──
  const ratingNode =
    avgRating !== null ? (
      <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm backdrop-blur">
        <StarRow rating={Math.round(avgRating)} size="sm" />
        <span className="text-sm font-bold text-[var(--foreground)]">{avgRating.toFixed(1)}</span>
        <span className="text-xs text-[var(--muted)]">({business.reviews.length} ביקורות)</span>
      </span>
    ) : null;

  // ── contact + social pills ──
  const pill =
    "flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/85 px-3.5 py-2 text-xs text-[var(--muted)] backdrop-blur transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]";
  const contactNode = hasContactRow ? (
    <>
      {business.showAddress && addressLabel && (
        <a href={mapsSearchUrl(mapQuery)} target="_blank" rel="noopener noreferrer" className={pill}>
          <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
          {addressLabel}
          <Navigation className="h-3 w-3 shrink-0 opacity-60" />
        </a>
      )}
      {business.showPhone && business.phone && (
        <a href={`tel:${business.phone}`} dir="ltr" className={pill}>
          <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
          {business.phone}
        </a>
      )}
      <div className="flex items-center gap-2">
        {waHref && (
          <a
            href={waHref}
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/85 text-[var(--muted)] backdrop-blur transition-colors hover:border-pink-300 hover:text-pink-600"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white/85 text-[var(--muted)] backdrop-blur transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            <FacebookIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    </>
  ) : null;

  // ── booking card (sticky column) ──
  const bookingSlot = bookingForm ? (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white shadow-[0_24px_60px_-24px_rgba(124,58,97,0.34)]">
      {!hideBookingHeader && (
        <div className="relative overflow-hidden px-6 pb-5 pt-6 text-center text-white" style={{ background: grd }}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)", filter: "blur(8px)" }}
          />
          <h2 className="relative text-lg font-bold">קביעת תור ב־3 צעדים</h2>
          <p className="relative mt-1 inline-flex items-center gap-1.5 text-xs text-white/90">
            <ShieldCheck className="h-3.5 w-3.5" />
            מאובטח · מהיר · ללא התחייבות
          </p>
        </div>
      )}
      <div className="p-5 sm:p-6">{bookingForm}</div>
    </div>
  ) : null;

  return (
    <PublicBookingHero
      brand={brand}
      name={business.name}
      tagline={tagline}
      coverUrl={business.coverImageUrl}
      logoUrl={business.logoUrl}
      initials={business.name.charAt(0)}
      rating={ratingNode}
      contact={contactNode}
      bookingSlot={bookingSlot}
      belowIdentity={secondaryContent}
    />
  );
}
