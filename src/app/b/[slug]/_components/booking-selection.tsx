"use client";

/**
 * Shared booking-selection state for the public page. Lets the booking form
 * (left column) publish what the customer has picked so a compact summary can
 * mirror it in the right column on desktop — without the two columns having to
 * be the same component.
 *
 * The default context value is a safe no-op, so the booking form can still be
 * rendered standalone (e.g. in unit tests) without a provider.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Calendar, Clock, MapPin, Phone } from "lucide-react";
import { formatDateHebrew } from "@/lib/booking/success-links";

export interface BookingSelection {
  serviceName: string | null;
  date: string;
  time: string;
  /** true once the customer is past service selection (step 2/3). */
  active: boolean;
}

interface Ctx {
  selection: BookingSelection | null;
  setSelection: (s: BookingSelection | null) => void;
}

const BookingSelectionContext = createContext<Ctx>({
  selection: null,
  setSelection: () => {},
});

export function useBookingSelection(): Ctx {
  return useContext(BookingSelectionContext);
}

export function BookingSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const value = useMemo(() => ({ selection, setSelection }), [selection]);
  return (
    <BookingSelectionContext.Provider value={value}>
      {children}
    </BookingSelectionContext.Provider>
  );
}

/**
 * Compact, desktop-only appointment summary shown under the hero in the right
 * column. Reflects the live selection so the right side never feels empty while
 * the booking card grows. Hidden until the customer has chosen a service.
 */
export function AppointmentSummary({
  brand,
  businessPhone,
  addressLabel,
}: {
  brand: string;
  businessPhone?: string | null;
  addressLabel?: string | null;
}) {
  const { selection } = useBookingSelection();

  if (!selection?.active || !selection.serviceName) return null;

  const formattedDate = formatDateHebrew(selection.date);

  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: `${brand}33`, boxShadow: `0 0 0 4px ${brand}0d` }}
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
        התור שלך
      </p>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
          <span aria-hidden="true">✨</span>
          <span>{selection.serviceName}</span>
        </div>

        {formattedDate && (
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <Calendar className="h-4 w-4 shrink-0" style={{ color: brand }} />
            <span>{formattedDate}</span>
          </div>
        )}
        {selection.time && (
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <Clock className="h-4 w-4 shrink-0" style={{ color: brand }} />
            <span>בשעה {selection.time}</span>
          </div>
        )}
      </div>

      {(businessPhone || addressLabel) && (
        <div className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
          {businessPhone && (
            <div className="flex items-center gap-1.5" dir="ltr">
              <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
              <span>{businessPhone}</span>
            </div>
          )}
          {addressLabel && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: brand }} />
              <span>{addressLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
