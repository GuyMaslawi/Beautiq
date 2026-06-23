import type { ReactNode } from "react";
import { Clock, MapPin, Phone, Info } from "lucide-react";
import type { PublicBusiness } from "@/server/public-booking/queries";
import {
  WEEKDAY_NAMES,
  minutesToTime,
  mapsSearchUrl,
  getBusinessWhatsAppHref,
} from "./helpers";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}

function CardTitle({
  icon: Icon,
  brand,
  children,
}: {
  icon: typeof Clock;
  brand: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Icon className="h-[18px] w-[18px] shrink-0" style={{ color: brand }} />
      <h2 className="text-base font-bold text-[var(--foreground)]">{children}</h2>
    </div>
  );
}

export function PublicBusinessInfo({
  business,
  brand,
  policyText,
}: {
  business: PublicBusiness;
  brand: string;
  policyText: string | null;
}) {
  const location = [business.city, business.area].filter(Boolean).join(", ");
  const addressLabel = business.addressNote || location;
  const mapQuery = [business.name, location].filter(Boolean).join(", ");
  const waHref = business.showPhone
    ? getBusinessWhatsAppHref(business.phone, business.name)
    : null;

  const showHours = business.showHours && business.availabilityDays.length > 0;
  const showContact =
    (business.showAddress && !!addressLabel) ||
    (business.showPhone && !!business.phone);
  const showPolicy = !!policyText;

  if (!showHours && !showContact && !showPolicy) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Opening hours */}
        {showHours && (
          <Card>
            <CardTitle icon={Clock} brand={brand}>
              שעות פעילות
            </CardTitle>
            <dl className="divide-y divide-[var(--border)]">
              {business.availabilityDays.map((day) => (
                <div
                  key={day.weekday}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <dt className="font-medium text-[var(--foreground)]">
                    יום {WEEKDAY_NAMES[day.weekday] ?? day.weekday}
                  </dt>
                  <dd className="text-[var(--muted)]" dir="ltr">
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
          </Card>
        )}

        {/* Contact + policy */}
        {(showContact || showPolicy) && (
          <div className="space-y-5">
            {showContact && (
              <Card>
                <CardTitle icon={MapPin} brand={brand}>
                  פרטים ויצירת קשר
                </CardTitle>
                <div className="space-y-3">
                  {business.showAddress && addressLabel && (
                    <a
                      href={mapsSearchUrl(mapQuery)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
                    >
                      <MapPin
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: brand }}
                      />
                      <span>
                        {addressLabel}
                        <span className="mr-1.5 text-xs text-[var(--muted)]">
                          (ניווט)
                        </span>
                      </span>
                    </a>
                  )}
                  {business.showPhone && business.phone && (
                    <div className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                      <Phone className="h-4 w-4 shrink-0" style={{ color: brand }} />
                      <a href={`tel:${business.phone}`} dir="ltr">
                        {business.phone}
                      </a>
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[#1da851] hover:underline"
                        >
                          וואטסאפ
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {showPolicy && (
              <Card>
                <CardTitle icon={Info} brand={brand}>
                  מדיניות ביטולים
                </CardTitle>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {policyText}
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
