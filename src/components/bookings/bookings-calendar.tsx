"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  CalendarRange,
  X,
  Phone,
  Clock,
  Banknote,
} from "lucide-react";
import type { CalendarBookingItem } from "@/server/bookings/queries";
import { BOOKING_STATUS } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TZ = "Asia/Jerusalem";
const HOUR_HEIGHT = 72; // px per hour — tall enough to read 30-min appointments comfortably
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 22;
const TOTAL_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;

const HEBREW_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const STATUS_BG: Record<string, string> = {
  pending: "rgba(254,246,228,0.96)",
  approved: "rgba(247,238,243,0.96)",
  completed: "rgba(232,248,242,0.96)",
  cancelled: "rgba(245,244,248,0.96)",
  no_show: "rgba(254,236,236,0.96)",
  rescheduled: "rgba(234,242,254,0.96)",
};
const STATUS_BORDER: Record<string, string> = {
  pending: "rgba(184,150,10,0.35)",
  approved: "rgba(184,107,140,0.35)",
  completed: "rgba(61,139,110,0.35)",
  cancelled: "rgba(148,163,184,0.30)",
  no_show: "rgba(190,74,74,0.30)",
  rescheduled: "rgba(59,122,181,0.30)",
};
const STATUS_TEXT: Record<string, string> = {
  pending: "#7a6400",
  approved: "#8a3d60",
  completed: "#2e6b52",
  cancelled: "#6b7280",
  no_show: "#8b2e2e",
  rescheduled: "#2e5c8a",
};

// ---------------------------------------------------------------------------
// Date/time helpers (Israel timezone)
// ---------------------------------------------------------------------------

function israelDateStr(isoOrDate: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate,
  );
}

function israelHoursMinutes(iso: string): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  return {
    hours: parseInt(parts.find((p) => p.type === "hour")!.value, 10),
    minutes: parseInt(parts.find((p) => p.type === "minute")!.value, 10),
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sunday
  date.setDate(date.getDate() - dow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function today(): string {
  return israelDateStr(new Date());
}

function buildUrl(calDate: string, calView: "day" | "week"): string {
  return `/bookings?view=calendar&calDate=${calDate}&calView=${calView}`;
}

function topPx(iso: string): number {
  const { hours, minutes } = israelHoursMinutes(iso);
  const minutesFromStart = (hours - GRID_START_HOUR) * 60 + minutes;
  return (minutesFromStart / 60) * HOUR_HEIGHT;
}

function heightPx(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);
}

// ---------------------------------------------------------------------------
// Appointment detail panel
// ---------------------------------------------------------------------------

function AppointmentPanel({
  booking,
  onClose,
}: {
  booking: CalendarBookingItem;
  onClose: () => void;
}) {
  const bg = STATUS_BG[booking.status] ?? STATUS_BG.pending;
  const textColor = STATUS_TEXT[booking.status] ?? STATUS_TEXT.pending;
  const label =
    BOOKING_STATUS[booking.status as keyof typeof BOOKING_STATUS] ??
    booking.status;

  return (
    <div
      className="flex flex-col rounded-2xl border bg-white overflow-hidden"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 4px 24px rgba(43,37,48,0.10)",
        minWidth: 260,
        maxWidth: 320,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b"
        style={{ borderColor: "var(--border)", background: bg }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
            style={{ background: "rgba(255,255,255,0.7)", color: textColor }}
          >
            {label}
          </span>
          <span className="text-sm font-bold truncate" style={{ color: textColor }}>
            {booking.clientName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 hover:bg-black/8 transition-colors"
        >
          <X className="h-4 w-4" style={{ color: "var(--muted)" }} />
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1 text-sm" dir="rtl">
        <div className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
          {booking.serviceName}
        </div>

        <div className="flex items-center gap-2" style={{ color: "var(--foreground-soft)" }}>
          <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
          <span>
            {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
            <span className="mr-1.5 text-xs" style={{ color: "var(--muted)" }}>
              ({booking.durationMinutesSnapshot} דק׳)
            </span>
          </span>
        </div>

        {booking.clientPhone && (
          <div className="flex items-center gap-2" style={{ color: "var(--foreground-soft)" }}>
            <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
            <span dir="ltr">{booking.clientPhone}</span>
          </div>
        )}

        <div className="flex items-center gap-2" style={{ color: "var(--foreground-soft)" }}>
          <Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
          <span>₪{booking.priceSnapshot.toLocaleString("he-IL")}</span>
        </div>

        {booking.notes && (
          <div
            className="rounded-lg p-2.5 text-xs"
            style={{ background: "rgba(184,107,140,0.06)", color: "var(--foreground-soft)" }}
          >
            {booking.notes}
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <Link
          href={`/bookings/${booking.id}`}
          className="flex-1 flex h-8 items-center justify-center rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            color: "#fff",
            boxShadow: "0 1px 4px rgba(184,107,140,0.22)",
          }}
        >
          לפרטי התור
        </Link>
        <Link
          href={`/clients/${booking.clientId}`}
          className="flex h-8 items-center justify-center rounded-xl border px-3 text-xs font-medium transition-colors hover:bg-[var(--background-alt)]"
          style={{ borderColor: "var(--border)", color: "var(--foreground-soft)" }}
        >
          פרופיל לקוח
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time column
// ---------------------------------------------------------------------------

function TimeColumn() {
  return (
    <div className="shrink-0 relative" style={{ width: 52, height: TOTAL_HEIGHT }}>
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }).map((_, i) => {
        const hour = GRID_START_HOUR + i;
        return (
          <div
            key={hour}
            className="absolute right-0 flex items-center justify-end pr-2"
            style={{ top: i * HOUR_HEIGHT - 9, height: 18, width: "100%" }}
          >
            <span
              className="text-[11px] tabular-nums"
              style={{ color: "var(--muted-light, #bbb9c0)" }}
            >
              {String(hour).padStart(2, "0")}:00
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid background lines
// ---------------------------------------------------------------------------

function GridLines() {
  return (
    <>
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t pointer-events-none"
          style={{ top: i * HOUR_HEIGHT, borderColor: "var(--border)" }}
        />
      ))}
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }).map((_, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
          style={{
            top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
            borderColor: "var(--border)",
            opacity: 0.4,
          }}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Now indicator
// ---------------------------------------------------------------------------

function NowIndicator({ dateStr }: { dateStr: string }) {
  const todayStr = today();
  if (dateStr !== todayStr) return null;

  const now = new Date();
  const { hours } = israelHoursMinutes(now.toISOString());
  if (hours < GRID_START_HOUR || hours >= GRID_END_HOUR) return null;

  const top = topPx(now.toISOString());

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: top - 1 }}
    >
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#b86b8c" }} />
      <div className="flex-1 h-[1.5px]" style={{ background: "#b86b8c" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single day column
// ---------------------------------------------------------------------------

function DayColumn({
  dateStr,
  bookings,
  onSelect,
}: {
  dateStr: string;
  bookings: CalendarBookingItem[];
  onSelect: (b: CalendarBookingItem) => void;
}) {
  const dayBookings = bookings.filter(
    (b) => israelDateStr(b.startTime) === dateStr,
  );

  return (
    <div className="relative flex-1 min-w-0" style={{ height: TOTAL_HEIGHT }}>
      <GridLines />
      <NowIndicator dateStr={dateStr} />

      {dayBookings.map((b) => {
        const top = topPx(b.startTime);
        const h = heightPx(b.durationMinutesSnapshot);
        if (top < 0 || top > TOTAL_HEIGHT) return null;

        const bg = STATUS_BG[b.status] ?? STATUS_BG.pending;
        const border = STATUS_BORDER[b.status] ?? STATUS_BORDER.pending;
        const text = STATUS_TEXT[b.status] ?? STATUS_TEXT.pending;

        return (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className="absolute right-1 left-1 rounded-lg text-right transition-all hover:brightness-95 hover:shadow-md overflow-hidden"
            style={{
              top: top + 1,
              height: h - 2,
              background: bg,
              border: `1.5px solid ${border}`,
              color: text,
              zIndex: 10,
            }}
          >
            <div className="px-2 py-1 h-full flex flex-col justify-start">
              <p className="text-xs font-bold leading-tight truncate">{b.clientName}</p>
              {h >= 44 && (
                <p className="text-[11px] leading-tight mt-0.5 opacity-80 truncate">
                  {b.serviceName}
                </p>
              )}
              {h >= 58 && (
                <p className="text-[11px] leading-tight mt-0.5 opacity-65">
                  {formatTime(b.startTime)}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main calendar component
// ---------------------------------------------------------------------------

interface BookingsCalendarProps {
  bookings: CalendarBookingItem[];
  calDate: string; // YYYY-MM-DD Israel time
  calView: "day" | "week";
}

export function BookingsCalendar({
  bookings,
  calDate,
  calView,
}: BookingsCalendarProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarBookingItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - GRID_START_HOUR) * HOUR_HEIGHT - 32;
    }
  }, []);

  const todayStr = today();
  const wStart = weekStart(calDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wStart, i));

  const prevDate = calView === "day" ? addDays(calDate, -1) : addDays(calDate, -7);
  const nextDate = calView === "day" ? addDays(calDate, 1) : addDays(calDate, 7);

  const navigate = (d: string, v: "day" | "week") => router.push(buildUrl(d, v));

  const rangeLabel =
    calView === "day"
      ? formatDayLabel(calDate)
      : (() => {
          const wEnd = weekDays[6];
          const [sy, sm, sd] = wStart.split("-").map(Number);
          const [ey, em, ed] = wEnd.split("-").map(Number);
          const startFmt = new Date(sy, sm - 1, sd).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "long",
          });
          const endFmt = new Date(ey, em - 1, ed).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return `${startFmt} – ${endFmt}`;
        })();

  return (
    <div
      className="flex flex-col rounded-2xl border bg-white"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
        overflow: "clip",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shrink-0"
        style={{ borderColor: "var(--border)" }}
        dir="rtl"
      >
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(prevDate, calView)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--background-alt)]"
            style={{ borderColor: "var(--border)" }}
            aria-label="הקודם"
          >
            <ChevronRight className="h-4 w-4" style={{ color: "var(--foreground-soft)" }} />
          </button>

          <button
            onClick={() => navigate(todayStr, calView)}
            className="flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-[var(--background-alt)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground-soft)" }}
          >
            היום
          </button>

          <button
            onClick={() => navigate(nextDate, calView)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--background-alt)]"
            style={{ borderColor: "var(--border)" }}
            aria-label="הבא"
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--foreground-soft)" }} />
          </button>

          <span
            className="hidden sm:block text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {rangeLabel}
          </span>
        </div>

        {/* View toggle + new booking */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => navigate(calDate, "day")}
              className="flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors"
              style={{
                background: calView === "day" ? "rgba(184,107,140,0.10)" : "transparent",
                color: calView === "day" ? "#b86b8c" : "var(--foreground-soft)",
              }}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">יום</span>
            </button>
            <button
              onClick={() => navigate(wStart, "week")}
              className="flex h-8 items-center gap-1.5 border-r px-3 text-xs font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                background: calView === "week" ? "rgba(184,107,140,0.10)" : "transparent",
                color: calView === "week" ? "#b86b8c" : "var(--foreground-soft)",
              }}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">שבוע</span>
            </button>
          </div>

          <Link
            href="/bookings/new"
            className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
              color: "#fff",
              boxShadow: "0 1px 4px rgba(184,107,140,0.22)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>תור חדש</span>
          </Link>
        </div>
      </div>

      {/* Mobile date label */}
      <div className="block sm:hidden px-4 pt-2 pb-0 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {rangeLabel}
      </div>

      {/* Main grid — scrollRef fills remaining viewport height */}
      <div className="flex" dir="rtl" style={{ minHeight: 0 }}>
        {/* Scrollable time grid */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            height: "calc(100vh - 360px)",
            minHeight: 620,
          }}
        >
          {calView === "week" && (
            <div
              className="sticky top-0 z-30 flex border-b bg-white shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div style={{ width: 52 }} className="shrink-0" />
              {weekDays.map((d) => {
                const [y, m, day] = d.split("-").map(Number);
                const date = new Date(y, m - 1, day);
                const dow = date.getDay();
                const isToday = d === todayStr;
                return (
                  <button
                    key={d}
                    onClick={() => navigate(d, "day")}
                    className="flex-1 py-2 text-center transition-colors hover:bg-[var(--background-alt)]"
                  >
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: isToday ? "#b86b8c" : "var(--muted)" }}
                    >
                      {HEBREW_DAYS_SHORT[dow]}
                    </p>
                    <div
                      className="mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: isToday ? "#b86b8c" : "transparent",
                        color: isToday ? "#fff" : "var(--foreground-soft)",
                      }}
                    >
                      {day}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Time grid */}
          <div className="flex relative">
            <TimeColumn />

            {calView === "day" ? (
              <DayColumn
                dateStr={calDate}
                bookings={bookings}
                onSelect={setSelected}
              />
            ) : (
              <div className="flex flex-1 min-w-0">
                {weekDays.map((d) => (
                  <DayColumn
                    key={d}
                    dateStr={d}
                    bookings={bookings}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            )}

            {/* Empty state — shown when no bookings in current view */}
            {bookings.length === 0 && (
              <div
                className="absolute flex flex-col items-center justify-center gap-3 pointer-events-none"
                style={{
                  top: 2 * HOUR_HEIGHT,
                  right: 52,
                  left: 0,
                  height: 140,
                }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                  {calView === "day" ? "אין תורים ביום הזה" : "אין תורים בשבוע הזה"}
                </p>
                <Link
                  href="/bookings/new"
                  className="flex items-center gap-1 text-xs font-semibold rounded-lg px-3 py-1.5 transition-opacity hover:opacity-80 pointer-events-auto"
                  style={{
                    background: "rgba(184,107,140,0.10)",
                    color: "#b86b8c",
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  קביעת תור חדש
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel — desktop only */}
        {selected && (
          <div
            className="hidden lg:flex shrink-0 border-r p-4"
            style={{ borderColor: "var(--border)", width: 300 }}
          >
            <AppointmentPanel booking={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* Mobile detail sheet */}
      {selected && (
        <div className="lg:hidden border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
          <AppointmentPanel booking={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
