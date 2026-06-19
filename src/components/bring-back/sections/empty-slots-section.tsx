import Link from "next/link";
import { CalendarRange, MessageCircle, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getEmptySlotsData } from "@/server/empty-slots/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const TZ = "Asia/Jerusalem";
const WEEKDAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  return d.toLocaleDateString("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  });
}

function buildWhatsAppText(
  clientName: string,
  businessName: string,
  dateStr: string,
  startMinutes: number,
  weekday: number,
): string {
  const dateLabel = formatDate(dateStr);
  const timeLabel = formatMinutes(startMinutes);
  const dayLabel = WEEKDAY_NAMES[weekday] ?? "";
  return `היי ${clientName}, יש לי חלון פנוי ביום ${dayLabel} ${dateLabel} בשעה ${timeLabel}. רצית לקבוע תור? 😊 — ${businessName}`;
}

function daysSince(isoOrNull: string | null): number | null {
  if (!isoOrNull) return null;
  return Math.floor((Date.now() - new Date(isoOrNull).getTime()) / 86400000);
}

function getInitial(name: string): string {
  return name.trim()[0] ?? "?";
}

/** מילוי שעות ריקות — חלונות פנויים והצעת לקוחות לפנייה. */
export async function EmptySlotsSection() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };
  const data = await getEmptySlotsData(tenant);
  const { slots, suggestedClients } = data;

  const businessName = business.name ?? "העסק שלי";

  return (
    <div className="w-full space-y-6" dir="rtl">
      <PageHeader
        icon={CalendarRange}
        title="חלונות פנויים"
        subtitle="חלונות זמן פנויים לשבוע הקרוב — שלחי הזמנה ללקוחות שלא חזרו."
      />

      {/* Suggested clients */}
      {suggestedClients.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: "rgba(61,139,110,0.06)",
            border: "1px solid rgba(61,139,110,0.18)",
          }}
        >
          <p className="mb-3 text-sm font-semibold" style={{ color: "#2d6b55" }}>
            לקוחות שמומלץ לפנות אליהן
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedClients.map((client) => {
              const days = daysSince(client.lastVisitAtISO);
              return (
                <div
                  key={client.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.80)",
                    border: "1px solid rgba(61,139,110,0.15)",
                  }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(201,120,152,0.85) 0%, rgba(184,107,140,0.75) 100%)",
                    }}
                  >
                    {getInitial(client.fullName)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#2b2530" }}>
                      {client.fullName}
                    </p>
                    {days !== null && (
                      <p className="text-xs" style={{ color: "#8a8190" }}>
                        לא חזרה {days} ימים
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty slots list */}
      {slots.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,122,181,0.10) 0%, rgba(59,122,181,0.06) 100%)",
              }}
            >
              <CalendarRange className="h-6 w-6" style={{ color: "#3b7ab5" }} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-foreground font-semibold text-base">
              אין חלונות פנויים לשבוע הקרוב
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              לוח הזמנים שלך מלא. כשיפתח חלון פנוי, הוא יופיע כאן.
            </p>
          </div>
          <Link href="/availability">
            <Button variant="secondary" size="sm">
              <Clock className="h-3.5 w-3.5 ml-1.5" />
              ניהול שעות פעילות
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, idx) => {
            const dayName = WEEKDAY_NAMES[slot.weekday] ?? "";
            const dateLabel = formatDate(slot.date);
            const startLabel = formatMinutes(slot.startMinutes);
            const endLabel = formatMinutes(slot.endMinutes);
            const durationH = Math.floor(slot.durationMinutes / 60);
            const durationM = slot.durationMinutes % 60;
            const durationLabel =
              durationH > 0
                ? durationM > 0
                  ? `${durationH} שעות ו-${durationM} דקות`
                  : `${durationH} שעות`
                : `${durationM} דקות`;

            const firstClient = suggestedClients[0];
            const waText = firstClient
              ? buildWhatsAppText(firstClient.fullName, businessName, slot.date, slot.startMinutes, slot.weekday)
              : buildWhatsAppText("לקוחה", businessName, slot.date, slot.startMinutes, slot.weekday);

            const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 1px 6px rgba(43,37,48,0.06)",
                }}
              >
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  {/* Slot info */}
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: "rgba(59,122,181,0.10)",
                      }}
                    >
                      <CalendarRange className="h-4 w-4" style={{ color: "#3b7ab5" }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                        יום {dayName}, {dateLabel}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                        {startLabel}–{endLabel} · {durationLabel} פנויות
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`שלחי הזמנה לתור ב-${dayName} ${dateLabel} בשעה ${startLabel}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-85"
                    style={{
                      background: "rgba(37,211,102,0.10)",
                      color: "#1a9e4e",
                      border: "1px solid rgba(37,211,102,0.22)",
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    שלחי הזמנה
                  </a>
                </div>

                {/* Per-slot suggested clients row */}
                {suggestedClients.length > 0 && (
                  <div
                    className="flex flex-wrap gap-2 px-5 pb-4"
                  >
                    {suggestedClients.map((client) => {
                      const clientWa = buildWhatsAppText(
                        client.fullName,
                        businessName,
                        slot.date,
                        slot.startMinutes,
                        slot.weekday,
                      );
                      return (
                        <a
                          key={client.id}
                          href={buildWhatsAppUrl(client.phone, clientWa) ?? "#"}
                          target={buildWhatsAppUrl(client.phone, clientWa) ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          aria-label={`שלחי הזמנה ל-${client.fullName}`}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                          style={{
                            background: "rgba(184,107,140,0.08)",
                            color: "#b86b8c",
                            border: "1px solid rgba(184,107,140,0.20)",
                          }}
                        >
                          <Users className="h-3 w-3" />
                          {client.fullName}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
