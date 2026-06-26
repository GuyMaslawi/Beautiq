import { MapPin, Phone, Navigation } from "lucide-react";
import type { PublicBusiness } from "@/server/public-booking/queries";
import { PublicBookingHero } from "@/components/premium/public-booking-hero";
import { StarRow, InstagramIcon, FacebookIcon, WhatsAppIcon } from "./icons";
import {
  normalizeInstagramUrl,
  normalizeSocialUrl,
  getBusinessWhatsAppHref,
  mapsSearchUrl,
} from "./helpers";

/**
 * Compact public business header. Maps the business record onto the
 * presentational {@link PublicBookingHero} shell: cover/logo, name, tagline,
 * rating chip and a row of contact + social pills. It is intentionally short so
 * the booking wizard (rendered separately below) stays the primary focus.
 */
export function PublicBusinessHeader({
  business,
  brand,
  avgRating,
}: {
  business: PublicBusiness;
  brand: string;
  avgRating: number | null;
}) {
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

  // ── rating chip ──
  const ratingNode =
    avgRating !== null ? (
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 shadow-sm">
        <StarRow rating={Math.round(avgRating)} size="sm" />
        <span className="text-sm font-bold text-[var(--foreground)]">
          {avgRating.toFixed(1)}
        </span>
        <span className="text-xs text-[var(--muted)]">
          ({business.reviews.length} ביקורות)
        </span>
      </span>
    ) : null;

  // ── contact + social pills ──
  const pill =
    "flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]";
  const contactNode = hasContactRow ? (
    <>
      {business.showAddress && addressLabel && (
        <a
          href={mapsSearchUrl(mapQuery)}
          target="_blank"
          rel="noopener noreferrer"
          className={pill}
        >
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
    </>
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
    />
  );
}
