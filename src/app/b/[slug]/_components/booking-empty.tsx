import { CalendarX2, Phone } from "lucide-react";
import { getBusinessWhatsAppHref } from "./helpers";

/**
 * Premium empty state shown inside the booking card when the business has no
 * active services to offer. Keeps the page useful (a contact path) instead of
 * leaving the primary area blank.
 */
export function BookingUnavailable({
  brand,
  phone,
  businessName,
}: {
  brand: string;
  phone: string | null;
  businessName: string;
}) {
  const waHref = getBusinessWhatsAppHref(phone, businessName);

  return (
    <div className="py-6 text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
        style={{ background: `linear-gradient(135deg, ${brand}, ${brand}aa)` }}
      >
        <CalendarX2 className="h-7 w-7" />
      </div>
      <p className="text-base font-bold text-[var(--foreground)]">
        העסק עדיין לא פרסם שירותים להזמנה
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-[var(--muted)]">
        אפשר ליצור קשר ישירות כדי לקבוע תור.
      </p>

      {phone && (
        <div className="mt-5 flex flex-col items-center gap-2.5">
          <a
            href={`tel:${phone}`}
            dir="ltr"
            className="inline-flex items-center gap-2 rounded-2xl border-2 px-5 py-2.5 text-sm font-bold transition-colors"
            style={{ borderColor: brand, color: brand }}
          >
            <Phone className="h-4 w-4" />
            {phone}
          </a>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#1da851] hover:underline"
            >
              שליחת הודעה בוואטסאפ
            </a>
          )}
        </div>
      )}
    </div>
  );
}
