/**
 * Static secondary cards shown under the hero in the right column on desktop.
 * They give the booking area a balanced, cohesive feel so the right side never
 * sits empty while the booking card grows. Desktop-only; the mobile flow keeps
 * its single-column sections below the form.
 */

import { MapPin, Phone, ShieldCheck, Heart, Clock } from "lucide-react";
import type { PublicBusiness } from "@/server/public-booking/queries";

const TRUST_POINTS = [
  { icon: Heart, text: "שירות אישי ומותאם" },
  { icon: Clock, text: "קביעת תור מהירה ונוחה" },
  { icon: ShieldCheck, text: "אישור התור ישירות מול העסק" },
];

export function PublicBookingSecondary({
  business,
  brand,
  addressLabel,
}: {
  business: Pick<PublicBusiness, "phone" | "showPhone" | "showAddress">;
  brand: string;
  addressLabel: string | null;
}) {
  const showContact =
    (business.showPhone && !!business.phone) ||
    (business.showAddress && !!addressLabel);

  return (
    <div className="space-y-4">
      {/* Why choose us — compact trust card */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <p className="mb-3 text-sm font-bold text-[var(--foreground)]">
          למה לבחור בנו?
        </p>
        <ul className="space-y-2.5">
          {TRUST_POINTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-2.5 text-sm text-[var(--foreground)]"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${brand}12`, color: brand }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Business contact card */}
      {showContact && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-[var(--foreground)]">
            יצירת קשר
          </p>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            {business.showPhone && business.phone && (
              <a
                href={`tel:${business.phone}`}
                dir="ltr"
                className="flex items-center justify-end gap-2 transition-colors hover:text-[var(--foreground)]"
              >
                <span>{business.phone}</span>
                <Phone className="h-4 w-4 shrink-0" style={{ color: brand }} />
              </a>
            )}
            {business.showAddress && addressLabel && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" style={{ color: brand }} />
                <span>{addressLabel}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
