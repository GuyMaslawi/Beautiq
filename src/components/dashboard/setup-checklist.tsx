"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  Users2,
  Sparkles,
  TrendingUp,
  Clock,
  MessageCircle,
  Plus,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Circle,
  RefreshCcw,
  BellRing,
  XCircle,
} from "lucide-react";
import { AUTOMATIONS, BOOKING_STATUS, BOOKINGS, DASHBOARD } from "@/lib/constants/he";
import { FadeIn, StaggerIn, StaggerItem } from "@/components/ui/animate";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { GuidanceItem } from "@/lib/guidance/rules";
import type { EmptySlot } from "@/lib/empty-slots/find-empty-slots";
import type { SuggestedClient } from "@/server/empty-slots/queries";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TZ = "Asia/Jerusalem";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getInitial(name: string): string {
  return name.trim()[0] ?? "?";
}

function daysSince(isoOrNull: string | null): number | null {
  if (!isoOrNull) return null;
  return Math.floor((Date.now() - new Date(isoOrNull).getTime()) / 86400000);
}

// ── Checklist helpers ─────────────────────────────────────────────────────────

interface ChecklistItemDef {
  label: string;
  href: string;
  done: boolean;
}

function buildChecklist(setup: SetupState): ChecklistItemDef[] {
  return [
    { label: DASHBOARD.progress.items.categories, href: "/settings", done: setup.hasCategories },
    { label: DASHBOARD.progress.items.service, href: "/services/new", done: setup.hasActiveService },
    { label: DASHBOARD.progress.items.availability, href: "/availability", done: setup.hasAvailabilityRule },
    { label: DASHBOARD.progress.items.profile, href: "/settings", done: setup.hasProfileDetails },
    { label: DASHBOARD.progress.items.publicLink, href: "/settings", done: true },
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardHero — command center
// ══════════════════════════════════════════════════════════════════════════════

function DashboardHero({
  businessName,
  metrics,
  pendingApprovalCount,
}: {
  businessName: string;
  metrics: DashboardMetrics;
  pendingApprovalCount: number;
}) {
  const todayLabel = new Date().toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(145deg, #2b0e1f 0%, #3e1630 55%, #2c1527 100%)",
        border: "1px solid rgba(184,107,140,0.28)",
        boxShadow: "0 8px 32px rgba(120,40,80,0.28), 0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      {/* Background glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 78% 15%, rgba(201,120,152,0.22) 0%, transparent 52%), radial-gradient(ellipse at 12% 85%, rgba(184,107,140,0.13) 0%, transparent 48%)",
        }}
      />

      <div className="relative px-7 py-7">
        {/* Top row: greeting + date */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.50)" }}>
              שלום,
            </p>
            <h1
              className="text-3xl font-bold leading-tight tracking-tight text-white"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
            >
              {businessName}
            </h1>
          </div>

          {/* Date + revenue pill */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              {todayLabel}
            </p>
            <Link
              href="/bookings"
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.96]"
              style={{
                background: "rgba(61,139,110,0.22)",
                border: "1px solid rgba(61,139,110,0.32)",
                color: "#7ee8b8",
              }}
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>{formatILS(metrics.monthRevenue)}</span>
              <span className="text-xs font-normal" style={{ color: "rgba(126,232,184,0.65)" }}>
                החודש
              </span>
            </Link>
          </div>
        </div>

        {/* Attention badge row */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {/* Bookings today — always a link */}
          <Link
            href="/bookings?filter=today"
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all hover:brightness-125 active:scale-[0.96]"
            style={{
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#f0a8c8" }} />
            <span className="text-sm font-bold text-white">{metrics.bookingsToday}</span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              פגישות היום
            </span>
          </Link>

          {/* Pending approval */}
          {pendingApprovalCount > 0 ? (
            <Link
              href="/bookings?status=pending"
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all hover:brightness-110 active:scale-[0.96]"
              style={{
                background: "rgba(212,168,30,0.18)",
                border: "1px solid rgba(212,168,30,0.32)",
              }}
            >
              <Clock className="h-4 w-4 shrink-0" style={{ color: "#f5c842" }} />
              <span className="text-sm font-bold" style={{ color: "#f5e090" }}>
                {pendingApprovalCount}
              </span>
              <span className="text-sm" style={{ color: "rgba(245,224,144,0.75)" }}>
                ממתינות לאישור
              </span>
            </Link>
          ) : (
            <Link
              href="/bookings"
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all hover:brightness-125 active:scale-[0.96]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Clock className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.30)" }}>
                אין פגישות ללא אישור
              </span>
            </Link>
          )}

          {/* Active clients — always a link */}
          <Link
            href="/clients"
            className="flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all hover:brightness-125 active:scale-[0.96]"
            style={{
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Users2 className="h-4 w-4 shrink-0" style={{ color: "#c0a8f0" }} />
            <span className="text-sm font-bold text-white">{metrics.totalClients}</span>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              לקוחות פעילים
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardQuickActions
// ══════════════════════════════════════════════════════════════════════════════

function ActionPill({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all hover:shadow-sm"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--foreground-soft)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "#b86b8c" }} />
      <span>{label}</span>
    </Link>
  );
}

function DashboardQuickActions() {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold" style={{ color: "var(--muted)" }}>
        פעולות מהירות
      </p>
      <div className="flex flex-wrap gap-2.5">
        <ActionPill href="/bring-back" icon={RefreshCcw} label="החזרת לקוחות" />
        <ActionPill href="/services/new" icon={Sparkles} label="הוספת שירות" />
        <ActionPill href="/clients" icon={UserPlus} label="הוספת לקוחה" />
        <ActionPill href="/availability" icon={Clock} label="שעות פעילות" />
        {/* Primary CTA — last in DOM = leftmost in RTL */}
        <Link
          href="/bookings/new"
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            boxShadow: "0 2px 10px rgba(184,107,140,0.35)",
          }}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <Plus className="h-3 w-3 shrink-0 -ms-1 opacity-75" />
          <span>קביעת פגישה חדשה</span>
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardMetricCard
// ══════════════════════════════════════════════════════════════════════════════

function DashboardMetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  accent = false,
  href,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={
          accent
            ? { background: "rgba(184,107,140,0.14)" }
            : { background: "rgba(43,37,48,0.06)" }
        }
      >
        <Icon
          className="h-4 w-4"
          style={{ color: accent ? "#b86b8c" : "#8a8190" }}
        />
      </div>

      <div>
        <p
          className="text-2xl font-bold tabular-nums tracking-tight"
          style={{ color: accent ? "#b86b8c" : "var(--foreground)" }}
        >
          {value}
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--muted)" }}>
          {title}
        </p>
      </div>

      {subtext && (
        <p className="text-xs leading-5" style={{ color: "var(--muted-light)" }}>
          {subtext}
        </p>
      )}
    </>
  );

  const sharedStyle = accent
    ? {
        background: "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)",
        border: "1px solid rgba(184,107,140,0.22)",
        boxShadow: "0 2px 10px rgba(184,107,140,0.10)",
      }
    : {
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      };

  if (href) {
    return (
      <Link
        href={href}
        className="relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl p-4 transition-all hover:shadow-md hover:brightness-[1.03] active:scale-[0.97]"
        style={sharedStyle}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 transition-shadow hover:shadow-md"
      style={sharedStyle}
    >
      {inner}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TodayAppointmentsCard
// ══════════════════════════════════════════════════════════════════════════════

function bookingStatusStyle(status: UpcomingBookingItem["status"]) {
  if (status === "approved") return { background: "rgba(61,139,110,0.10)", color: "#3d8b6e" };
  if (status === "completed") return { background: "rgba(59,122,181,0.10)", color: "#2a5a8a" };
  return { background: "rgba(184,150,10,0.10)", color: "#7a6400" }; // pending
}

function TodayAppointmentsCard({
  todayBookings,
}: {
  todayBookings: UpcomingBookingItem[];
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
          הפגישות שלך להיום
        </h2>
        {todayBookings.length > 0 && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {todayBookings.length} פגישות היום
          </p>
        )}
      </div>

      {/* Booking list */}
      {todayBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-5 text-center">
          <div
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(184,107,140,0.10)" }}
          >
            <CalendarDays className="h-5 w-5" style={{ color: "#b86b8c" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
            אין פגישות להיום
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-light)" }}>
            קבעי פגישה חדשה או בדקי חלונות פנויים.
          </p>
          <Link
            href="/bookings/new"
            className="mt-3 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#b86b8c" }}
          >
            + קביעת פגישה חדשה
          </Link>
        </div>
      ) : (
        <ul>
          {todayBookings.map((booking, idx) => {
            const time = formatTimeOnly(booking.startTimeISO);
            const initial = getInitial(booking.clientName);
            const isLast = idx === todayBookings.length - 1;
            return (
              <li
                key={booking.id}
                style={!isLast ? { borderBottom: "1px solid var(--border)" } : undefined}
              >
                <Link
                  href={`/bookings/${booking.id}`}
                  className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-background-alt"
                >
                  {/* Time */}
                  <span
                    className="w-11 shrink-0 text-sm font-bold tabular-nums"
                    style={{ color: "#b86b8c" }}
                  >
                    {time}
                  </span>

                  {/* Avatar */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(201,120,152,0.85) 0%, rgba(184,107,140,0.75) 100%)",
                    }}
                  >
                    {initial}
                  </div>

                  {/* Name + service */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {booking.clientName}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                      {booking.serviceName}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={bookingStatusStyle(booking.status)}
                  >
                    {BOOKING_STATUS[booking.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      <div
        className="mt-auto shrink-0 px-5 py-3.5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Link
          href="/bookings"
          className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "#b86b8c" }}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>צפייה בכל הפגישות</span>
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AttentionCard
// ══════════════════════════════════════════════════════════════════════════════

type AttentionColor = "green" | "warning" | "rose" | "info";

const ATTENTION_PALETTE: Record<
  AttentionColor,
  { bg: string; iconBg: string; iconColor: string; fg: string }
> = {
  green: {
    bg: "rgba(61,139,110,0.07)",
    iconBg: "rgba(61,139,110,0.14)",
    iconColor: "#3d8b6e",
    fg: "#2d6b55",
  },
  warning: {
    bg: "rgba(184,150,10,0.07)",
    iconBg: "rgba(184,150,10,0.15)",
    iconColor: "#b87c1e",
    fg: "#7a6400",
  },
  rose: {
    bg: "rgba(190,74,74,0.07)",
    iconBg: "rgba(190,74,74,0.14)",
    iconColor: "#be4a4a",
    fg: "#8b3333",
  },
  info: {
    bg: "rgba(59,122,181,0.07)",
    iconBg: "rgba(59,122,181,0.14)",
    iconColor: "#3b7ab5",
    fg: "#2a5a8a",
  },
};

function AttentionCard({
  count,
  label,
  subLabel,
  action,
  href,
  icon: Icon,
  color,
  ariaLabel,
}: {
  count: number | string;
  label: string;
  subLabel: string;
  action: string;
  href: string;
  icon: LucideIcon;
  color: AttentionColor;
  ariaLabel?: string;
}) {
  const p = ATTENTION_PALETTE[color];
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${count} ${label} — ${action}`}
      className="flex cursor-pointer items-center gap-3 rounded-xl p-3.5 transition-all hover:opacity-90 hover:shadow-md"
      style={{ background: p.bg, border: `1px solid transparent` }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: p.iconBg }}
      >
        <Icon className="h-4 w-4" style={{ color: p.iconColor }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight" style={{ color: p.fg }}>
          {count} {label}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: p.fg, opacity: 0.75 }}>
          {subLabel}
        </p>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 text-xs font-semibold"
        style={{ color: p.iconColor }}
      >
        <span>{action}</span>
        <ArrowLeft className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WeekCalendarMini
// ══════════════════════════════════════════════════════════════════════════════

const HEBREW_DAY_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function WeekCalendarMini({
  allBookings,
}: {
  allBookings: UpcomingBookingItem[];
}) {
  const { slots } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });

    const countByDay: Record<string, number> = {};
    for (const b of allBookings) {
      const dayStr = new Date(b.startTimeISO).toLocaleDateString("en-CA", { timeZone: TZ });
      countByDay[dayStr] = (countByDay[dayStr] ?? 0) + 1;
    }

    const slotsArr = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
      const utcDay = new Date(dayStr + "T12:00:00Z").getUTCDay();
      return {
        dayStr,
        label: HEBREW_DAY_SHORT[utcDay] ?? "?",
        count: countByDay[dayStr] ?? 0,
        isToday: dayStr === todayStr,
      };
    });

    return { slots: slotsArr };
  }, [allBookings]);

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          מבט על השבוע
        </h3>
        <Link
          href="/bookings/new"
          className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
        >
          + הוספת משבצת
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {slots.map((slot) => (
          <div
            key={slot.dayStr}
            className="flex flex-col items-center gap-1 rounded-xl py-2.5"
            style={
              slot.isToday
                ? {
                    background:
                      "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                    boxShadow: "0 2px 8px rgba(184,107,140,0.28)",
                  }
                : { background: "var(--background-alt)" }
            }
          >
            <span
              className="text-xs font-semibold"
              style={{
                color: slot.isToday ? "rgba(255,255,255,0.80)" : "var(--muted)",
              }}
            >
              {slot.label}
            </span>
            <span
              className="text-base font-bold tabular-nums"
              style={{ color: slot.isToday ? "#fff" : "var(--foreground)" }}
            >
              {slot.count}
            </span>
            <span
              className="text-[10px]"
              style={{
                color: slot.isToday ? "rgba(255,255,255,0.60)" : "var(--muted-light)",
              }}
            >
              תורים
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/bookings"
        className="mt-3 flex items-center gap-1.5 pt-3 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ borderTop: "1px solid var(--border)", color: "#b86b8c" }}
      >
        <CalendarRange className="h-3 w-3" />
        <span>צפייה בכל המשבצות</span>
      </Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FollowUpClientsPreview
// ══════════════════════════════════════════════════════════════════════════════

function FollowUpClientsPreview({ clients }: { clients: SuggestedClient[] }) {
  const displayed = clients.slice(0, 3);

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          לקוחות למעקב ושימור
        </h3>
      </div>

      {clients.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            אין לקוחות למעקב כרגע
          </p>
          <Link
            href="/bring-back"
            className="mt-2 inline-block text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#b86b8c" }}
          >
            מעבר להחזרת לקוחות
          </Link>
        </div>
      ) : (
        <ul>
          {displayed.map((client, idx) => {
            const days = daysSince(client.lastVisitAtISO);
            const isLast = idx === displayed.length - 1;
            return (
              <li
                key={client.id}
                className="flex items-center gap-3 px-4 py-3"
                style={!isLast ? { borderBottom: "1px solid var(--border)" } : undefined}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(201,120,152,0.85) 0%, rgba(184,107,140,0.75) 100%)",
                  }}
                >
                  {getInitial(client.fullName)}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {client.fullName}
                  </p>
                  {days !== null && (
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      לא חזרה כבר {days} ימים
                    </p>
                  )}
                </div>

                <Link
                  href="/bring-back"
                  className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: "rgba(37,211,102,0.09)",
                    color: "#1a9e4e",
                    border: "1px solid rgba(37,211,102,0.18)",
                  }}
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>שליחת הודעה</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {clients.length > 3 && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/bring-back"
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#b86b8c" }}
          >
            <ArrowLeft className="h-3 w-3" />
            <span>צפייה בכל הלקוחות למעקב</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SetupProgressCard
// ══════════════════════════════════════════════════════════════════════════════

function SetupProgressCard({ setup }: { setup: SetupState }) {
  const items = buildChecklist(setup);
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  if (progressPct === 100) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(184,107,140,0.18)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          {DASHBOARD.progress.title}
        </h3>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
          style={{ background: "rgba(184,107,140,0.10)", color: "#b86b8c" }}
        >
          {progressPct}%
        </span>
      </div>

      <div
        className="mb-3.5 h-1.5 overflow-hidden rounded-full"
        style={{ background: "rgba(184,107,140,0.10)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, #c97898 0%, #b86b8c 100%)",
          }}
        />
      </div>

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-background-alt"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#3d8b6e" }} />
              ) : (
                <Circle className="h-4 w-4 shrink-0" style={{ color: "var(--muted-light)" }} />
              )}
              <span
                className={`truncate text-xs font-medium ${
                  item.done ? "text-muted line-through" : "text-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GrowthInsightsSection — "תובנות וצמיחה"
// ══════════════════════════════════════════════════════════════════════════════

type InsightCardTheme = "rose" | "green" | "violet";

const INSIGHT_PALETTE: Record<
  InsightCardTheme,
  {
    bg: string;
    border: string;
    shadow: string;
    valueFg: string;
    mutedFg: string;
    ctaFg: string;
    progBg: string;
    progFill: string;
  }
> = {
  rose: {
    bg: "var(--surface)",
    border: "1px solid rgba(190,74,74,0.20)",
    shadow: "var(--shadow-sm)",
    valueFg: "#8b3333",
    mutedFg: "var(--muted)",
    ctaFg: "#be4a4a",
    progBg: "rgba(190,74,74,0.10)",
    progFill: "linear-gradient(90deg, #e06060 0%, #be4a4a 100%)",
  },
  green: {
    bg: "linear-gradient(135deg, #f0fdf8 0%, #e6f9f0 100%)",
    border: "1px solid rgba(61,139,110,0.22)",
    shadow: "0 2px 10px rgba(61,139,110,0.08)",
    valueFg: "#2d6b55",
    mutedFg: "rgba(45,107,85,0.65)",
    ctaFg: "#3d8b6e",
    progBg: "rgba(61,139,110,0.12)",
    progFill: "linear-gradient(90deg, #3d8b6e 0%, #2d7060 100%)",
  },
  violet: {
    bg: "var(--surface)",
    border: "1px solid var(--border)",
    shadow: "var(--shadow-sm)",
    valueFg: "var(--foreground)",
    mutedFg: "var(--muted)",
    ctaFg: "#b86b8c",
    progBg: "rgba(184,107,140,0.10)",
    progFill: "linear-gradient(90deg, #c97898 0%, #b86b8c 100%)",
  },
};

function InsightCard({
  title,
  value,
  explanation,
  cta,
  href,
  isEmpty,
  emptyText,
  progressPct,
  theme,
}: {
  title: string;
  value: string;
  explanation: string;
  cta: string;
  href: string;
  isEmpty: boolean;
  emptyText: string;
  progressPct?: number | null;
  theme: InsightCardTheme;
}) {
  const p = INSIGHT_PALETTE[theme];
  return (
    <Link
      href={href}
      className="flex cursor-pointer flex-col gap-3 rounded-2xl p-5 transition-all hover:shadow-md hover:brightness-[1.02] active:scale-[0.97]"
      style={{ background: p.bg, border: p.border, boxShadow: p.shadow }}
    >
      <h4 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
        {title}
      </h4>

      {isEmpty ? (
        <p className="flex-1 text-sm" style={{ color: "var(--muted)" }}>
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: p.valueFg }}>
            {value}
          </p>
          {progressPct !== null && progressPct !== undefined && (
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: p.progBg }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(progressPct, 100)}%`,
                  background: p.progFill,
                }}
              />
            </div>
          )}
          <p className="text-xs" style={{ color: p.mutedFg }}>
            {explanation}
          </p>
        </div>
      )}

      <div
        className="mt-auto flex items-center gap-1 text-xs font-semibold"
        style={{ color: p.ctaFg }}
      >
        <span>{cta}</span>
        <ArrowLeft className="h-3 w-3" />
      </div>
    </Link>
  );
}

function GrowthInsightsSection({
  atRiskCount,
  financeRevenue,
  financeExpenses,
  financeProfit,
}: {
  atRiskCount: number;
  financeRevenue: number;
  financeExpenses: number;
  financeProfit: number;
}) {
  const hasFinanceData = financeRevenue > 0 || financeExpenses > 0;
  const profitLabel = hasFinanceData
    ? `₪${Math.abs(Math.round(financeProfit)).toLocaleString("he-IL")} רווח`
    : "—";
  const financeExplanation = hasFinanceData
    ? `הכנסות ₪${Math.round(financeRevenue).toLocaleString("he-IL")} · הוצאות ₪${Math.round(financeExpenses).toLocaleString("he-IL")}`
    : "הכנסות, הוצאות ורווח";

  return (
    <FadeIn delay={0.14}>
      <div>
        <div className="mb-4">
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            הגדלת הכנסות
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InsightCard
            title="החזרת לקוחות"
            value={atRiskCount > 0 ? `${atRiskCount} לקוחות` : "הכול טוב"}
            explanation={
              atRiskCount > 0
                ? "לקוחות שלא חזרו ומחכות לפנייה"
                : "כל הלקוחות חזרו לאחרונה"
            }
            cta="לפעולה עכשיו"
            href="/bring-back"
            isEmpty={false}
            emptyText=""
            theme="rose"
          />
          <InsightCard
            title="כספים"
            value={profitLabel}
            explanation={financeExplanation}
            cta="מעבר לכספים"
            href="/finance"
            isEmpty={!hasFinanceData}
            emptyText="אין עדיין נתוני הכנסות"
            theme="green"
          />
          <InsightCard
            title="עמוד לקוחות"
            value="עמוד הזמנה ציבורי"
            explanation="לקוחות יכולים לשלוח בקשות תור"
            cta="הגדרת העמוד"
            href="/public-page"
            isEmpty={false}
            emptyText=""
            theme="violet"
          />
        </div>
      </div>
    </FadeIn>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main export — SetupChecklist
// ══════════════════════════════════════════════════════════════════════════════

export function SetupChecklist({
  businessName,
  metrics,
  setup,
  todayBookings,
  upcomingBookings,
  pendingApprovalCount,
  guidanceItems = [],
  emptySlots = [],
  suggestedClients = [],
  atRiskCount = 0,
  financeRevenue = 0,
  financeExpenses = 0,
  financeProfit = 0,
  remindersDueCount = 0,
  lateCancellationsCount = 0,
}: {
  businessName: string;
  metrics: DashboardMetrics;
  setup: SetupState;
  todayBookings: UpcomingBookingItem[];
  upcomingBookings: UpcomingBookingItem[];
  pendingApprovalCount: number;
  guidanceItems?: GuidanceItem[];
  emptySlots?: EmptySlot[];
  suggestedClients?: SuggestedClient[];
  atRiskCount?: number;
  financeRevenue?: number;
  financeExpenses?: number;
  financeProfit?: number;
  remindersDueCount?: number;
  lateCancellationsCount?: number;
}) {

  // Urgent guidance items not already covered by dedicated attention cards
  const extraUrgent = guidanceItems.filter(
    (item) =>
      item.priority === "important" &&
      item.id !== "pending-bookings" &&
      item.id !== "today-bookings" &&
      item.id !== "no-upcoming-bookings",
  );

  const hasAnyAttention =
    suggestedClients.length > 0 ||
    pendingApprovalCount > 0 ||
    emptySlots.length > 0 ||
    remindersDueCount > 0 ||
    lateCancellationsCount > 0 ||
    extraUrgent.length > 0;

  return (
    <div className="w-full space-y-6">
      {/* 1. Hero — full-width command center */}
      <FadeIn>
        <DashboardHero
          businessName={businessName}
          metrics={metrics}
          pendingApprovalCount={pendingApprovalCount}
        />
      </FadeIn>

      {/* 2. Quick actions */}
      <FadeIn delay={0.04}>
        <DashboardQuickActions />
      </FadeIn>

      {/* 3. KPI grid */}
      <StaggerIn
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
        delay={0.07}
      >
        <StaggerItem>
          <DashboardMetricCard
            title="הכנסה החודש"
            value={formatILS(metrics.monthRevenue)}
            subtext="מחישובי תורים שהושלמו"
            icon={TrendingUp}
            accent={metrics.monthRevenue > 0}
            href="/finance"
          />
        </StaggerItem>
        <StaggerItem>
          <DashboardMetricCard
            title="פגישות היום"
            value={String(metrics.bookingsToday)}
            subtext={metrics.bookingsToday === 0 ? "אין פגישות להיום" : "פגישות פעילות"}
            icon={CalendarDays}
            accent={metrics.bookingsToday > 0}
            href="/bookings?filter=today"
          />
        </StaggerItem>
        <StaggerItem>
          <DashboardMetricCard
            title="לקוחות פעילים"
            value={String(metrics.totalClients)}
            subtext="לקוחות שנשמרו במערכת"
            icon={Users2}
            href="/clients"
          />
        </StaggerItem>
        <StaggerItem>
          <DashboardMetricCard
            title="שירותים פעילים"
            value={String(metrics.activeServices)}
            subtext={
              metrics.activeServices === 0 ? "הוסיפו שירות ראשון" : "שירותים במערכת"
            }
            icon={Sparkles}
            href="/services"
          />
        </StaggerItem>
        <StaggerItem>
          <DashboardMetricCard
            title="ממתינות לאישור"
            value={String(pendingApprovalCount)}
            subtext={pendingApprovalCount === 0 ? "הכול מאושר" : "יש לאשר"}
            icon={Clock}
            accent={pendingApprovalCount > 0}
            href="/bookings?status=pending"
          />
        </StaggerItem>
      </StaggerIn>

      {/* 4. Main section: today's appointments + attention */}
      <FadeIn delay={0.10}>
        {hasAnyAttention ? (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
            {/* RIGHT column (3/5) — today's appointments */}
            <div className="lg:col-span-3">
              <TodayAppointmentsCard todayBookings={todayBookings} />
            </div>

            {/* LEFT column (2/5) — items requiring attention */}
            <div className="space-y-3 lg:col-span-2">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                דורש את תשומת הלב שלך
              </p>
              <div className="space-y-2.5">
                {suggestedClients.length > 0 && (
                  <AttentionCard
                    count={suggestedClients.length}
                    label="לקוחות שמחכות למעקב"
                    subLabel="לקוחות שלא חזרו זמן מה ומוכנות לפנייה"
                    action="לניהול שימור"
                    href="/bring-back"
                    icon={RefreshCcw}
                    color="green"
                    ariaLabel={`${suggestedClients.length} לקוחות שמחכות למעקב — מעבר לניהול שימור`}
                  />
                )}
                {pendingApprovalCount > 0 && (
                  <AttentionCard
                    count={pendingApprovalCount}
                    label="פגישות"
                    subLabel="עדיין ללא אישור"
                    action="לאישור עכשיו"
                    href="/bookings?status=pending"
                    icon={CalendarDays}
                    color="warning"
                    ariaLabel={`${pendingApprovalCount} פגישות ממתינות לאישור — עבור לפגישות ממתינות`}
                  />
                )}
                {emptySlots.length > 0 && (
                  <AttentionCard
                    count={emptySlots.length}
                    label="חלונות פנויים"
                    subLabel="זמן פנוי לשבוע הקרוב"
                    action="מילוי חלונות"
                    href="/dashboard#empty-slots"
                    icon={CalendarRange}
                    color="info"
                    ariaLabel={`${emptySlots.length} חלונות פנויים — מעבר לחלונות הפנויים`}
                  />
                )}
                {remindersDueCount > 0 && (
                  <AttentionCard
                    count={remindersDueCount}
                    label={remindersDueCount === 1 ? AUTOMATIONS.dashboard.attentionSingle : "תזכורות מוכנות"}
                    subLabel="ממתינות לשליחה בוואטסאפ"
                    action={AUTOMATIONS.dashboard.cta}
                    href="/automations"
                    icon={BellRing}
                    color="info"
                    ariaLabel={`${remindersDueCount} תזכורות ממתינות לשליחה — עבור לאוטומציות`}
                  />
                )}
                {lateCancellationsCount > 0 && (
                  <AttentionCard
                    count={lateCancellationsCount}
                    label={BOOKINGS.lateCancellation.dashboardCard.title}
                    subLabel={
                      lateCancellationsCount === 1
                        ? BOOKINGS.lateCancellation.dashboardCard.bodySingular
                        : BOOKINGS.lateCancellation.dashboardCard.bodyPlural(lateCancellationsCount)
                    }
                    action={BOOKINGS.lateCancellation.dashboardCard.cta}
                    href="/bookings?status=cancelled"
                    icon={XCircle}
                    color="rose"
                    ariaLabel={`${lateCancellationsCount} ביטולים מאוחרים — עבור לתורים שבוטלו`}
                  />
                )}
                {extraUrgent.map((item) => (
                  <AttentionCard
                    key={item.id}
                    count="!"
                    label={item.title}
                    subLabel={item.description}
                    action={item.actionLabel}
                    href={item.href}
                    icon={Clock}
                    color="warning"
                    ariaLabel={`${item.title}: ${item.description} — ${item.actionLabel}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <TodayAppointmentsCard todayBookings={todayBookings} />
        )}
      </FadeIn>

      {/* 5. Growth insights */}
      <GrowthInsightsSection
        atRiskCount={atRiskCount}
        financeRevenue={financeRevenue}
        financeExpenses={financeExpenses}
        financeProfit={financeProfit}
      />

      {/* 6. Week overview + follow-up clients side by side */}
      <FadeIn delay={0.18}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <WeekCalendarMini allBookings={[...todayBookings, ...upcomingBookings]} />
          <FollowUpClientsPreview clients={suggestedClients} />
        </div>
      </FadeIn>

      {/* 7. Setup checklist if incomplete */}
      <SetupProgressCard setup={setup} />
    </div>
  );
}
