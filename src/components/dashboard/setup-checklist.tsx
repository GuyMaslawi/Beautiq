"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  Users2,
  Sparkles,
  Clock,
  MessageCircle,
  Plus,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Circle,
  RefreshCcw,
  Star,
  TrendingUp,
} from "lucide-react";
import { BOOKING_STATUS, DASHBOARD } from "@/lib/constants/he";
import { FadeIn } from "@/components/ui/animate";
import { RevenueSection } from "@/components/dashboard/revenue-section";
import { AutomationsSection } from "@/components/dashboard/automations-section";
import { PremiumPageShell } from "@/components/premium/page-shell";
import { EditorialSectionHeader } from "@/components/premium/section-header";
import { BeautyInsightCard } from "@/components/premium/insight-card";
import { AuraBlob } from "@/components/premium/aura-blob";
import type { ToneKey } from "@/components/premium/tokens";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { RevenueForecastData } from "@/server/revenue-forecast/queries";
import type { RecentAutomationRun } from "@/server/automations/queries";
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

function statusTone(status: UpcomingBookingItem["status"]): ToneKey {
  if (status === "approved") return "success";
  if (status === "completed") return "info";
  return "warning"; // pending
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
// CommandCenterHero — full-bleed editorial command center
// ══════════════════════════════════════════════════════════════════════════════

function HeroStat({
  href,
  icon: Icon,
  value,
  label,
  iconColor,
}: {
  href: string;
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="ring-soft group flex items-center gap-3 rounded-2xl px-4 py-3 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "rgba(255,255,255,0.10)" }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="display-num truncate text-xl font-bold text-white">{value}</span>
        <span className="truncate text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
          {label}
        </span>
      </span>
    </Link>
  );
}

function CommandCenterHero({
  businessName,
  metrics,
}: {
  businessName: string;
  metrics: DashboardMetrics;
}) {
  const todayLabel = new Date().toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="spotlight grain relative isolate overflow-hidden rounded-[1.75rem]"
      style={{
        background: "linear-gradient(150deg, #2b0e1f 0%, #44183a 48%, #2c1527 100%)",
        border: "1px solid rgba(172,92,127,0.30)",
        boxShadow: "0 24px 60px -22px rgba(60,20,45,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <AuraBlob color="rgba(199,111,147,0.34)" size={360} style={{ top: -150, insetInlineEnd: -60 }} />
      <AuraBlob color="rgba(146,96,159,0.22)" size={300} style={{ bottom: -160, insetInlineStart: -80 }} />

      <div className="relative p-5 md:p-7">
        {/* Greeting row — warm serif greeting on the lead side, CTA on the trailing side */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="min-w-0">
            <span className="eyebrow" style={{ color: "rgba(240,168,200,0.9)" }}>
              לוח הבקרה שלך
            </span>
            <p className="mt-1.5 text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
              שלום,
            </p>
            <h1
              className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-white md:text-[2.5rem]"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.3)" }}
            >
              {businessName}
            </h1>
            <p className="mt-1.5 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              {todayLabel}
            </p>
          </div>

          {/* Primary CTA woven into the hero */}
          <Link
            href="/bookings/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] md:self-auto"
            style={{
              background: "linear-gradient(135deg, #e7a9c4 0%, #c76f93 45%, var(--primary) 100%)",
              boxShadow: "0 12px 28px -8px rgba(199,111,147,0.6)",
            }}
          >
            <CalendarDays className="h-4 w-4" />
            <Plus className="-ms-1.5 h-3 w-3 opacity-80" />
            קביעת פגישה חדשה
          </Link>
        </div>

        {/* Live pulse stats — a dense, symmetric band across the full hero width */}
        <div
          className="mt-5 grid grid-cols-2 gap-2.5 pt-5 md:mt-6 md:grid-cols-4 md:gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
        >
          <HeroStat
            href="/bookings?filter=today"
            icon={CalendarDays}
            value={metrics.bookingsToday}
            label="פגישות היום"
            iconColor="#f0a8c8"
          />
          <HeroStat
            href="/services"
            icon={Sparkles}
            value={metrics.activeServices}
            label="שירותים פעילים"
            iconColor="#f5c88a"
          />
          <HeroStat
            href="/finance"
            icon={TrendingUp}
            value={formatILS(metrics.monthRevenue)}
            label="הכנסה החודש"
            iconColor="#9fe3c2"
          />
          <HeroStat
            href="/clients"
            icon={Users2}
            value={metrics.totalClients}
            label="לקוחות פעילים"
            iconColor="#c0a8f0"
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QuickActions — refined navigation pills
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
      className="ring-soft flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-transform hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.72)",
        color: "var(--foreground-soft)",
        boxShadow: "0 4px 14px -6px rgba(124,58,97,0.16)",
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
      <span>{label}</span>
    </Link>
  );
}

function DashboardQuickActions() {
  return (
    <div className="flex flex-wrap gap-2.5">
      <ActionPill href="/bring-back" icon={RefreshCcw} label="החזרת לקוחות" />
      <ActionPill href="/services/new" icon={Sparkles} label="הוספת שירות" />
      <ActionPill href="/clients" icon={UserPlus} label="הוספת לקוחה" />
      <ActionPill href="/availability" icon={Clock} label="שעות פעילות" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TodayAppointments — editorial timeline panel
// ══════════════════════════════════════════════════════════════════════════════

function TodayAppointmentsPanel({
  todayBookings,
}: {
  todayBookings: UpcomingBookingItem[];
}) {
  return (
    <div className="aura-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-foreground font-display text-[15px] font-bold tracking-tight">הפגישות שלך להיום</h3>
        <Link
          href="/bookings"
          className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          כל הפגישות
        </Link>
      </div>
      <div className="editorial-rule mx-5" />

      {todayBookings.length === 0 ? (
        <div className="flex items-center gap-4 px-5 py-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(172,92,127,0.10)" }}
          >
            <CalendarDays className="h-6 w-6" style={{ color: "var(--primary)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--foreground-soft)" }}>
              אין פגישות להיום
            </p>
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              אפשר לנצל את הזמן למילוי שעות ריקות או החזרת לקוחות.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link
                href="/bookings/new"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#c76f93,#ac5c7f)" }}
              >
                <Plus className="h-3 w-3" />
                קביעת פגישה חדשה
              </Link>
              <Link
                href="/bookings"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "rgba(172,92,127,0.10)", color: "var(--primary)" }}
              >
                <CalendarRange className="h-3 w-3" />
                פתיחת היומן
              </Link>
              <Link
                href="/bring-back?tab=slots"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "rgba(61,139,110,0.10)", color: "#2f7d61" }}
              >
                <RefreshCcw className="h-3 w-3" />
                החזרת לקוחות
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4">
          {todayBookings.map((booking, idx) => {
            const tone = statusTone(booking.status);
            const isLast = idx === todayBookings.length - 1;
            return (
              <TimelineRow
                key={booking.id}
                time={formatTimeOnly(booking.startTimeISO)}
                initials={getInitial(booking.clientName)}
                name={booking.clientName}
                service={booking.serviceName}
                statusLabel={BOOKING_STATUS[booking.status]}
                tone={tone}
                href={`/bookings/${booking.id}`}
                last={isLast}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const TONE_HEX: Record<ToneKey, { fg: string; bg: string; border: string }> = {
  neutral: { fg: "#3d3545", bg: "rgba(138,129,144,0.10)", border: "rgba(138,129,144,0.22)" },
  brand: { fg: "var(--primary)", bg: "rgba(172,92,127,0.10)", border: "rgba(172,92,127,0.24)" },
  success: { fg: "#2f7d61", bg: "rgba(61,139,110,0.10)", border: "rgba(61,139,110,0.24)" },
  warning: { fg: "#a06a14", bg: "rgba(184,124,30,0.10)", border: "rgba(184,124,30,0.24)" },
  danger: { fg: "#b13b3b", bg: "rgba(190,74,74,0.10)", border: "rgba(190,74,74,0.24)" },
  info: { fg: "#2f6aa0", bg: "rgba(59,122,181,0.10)", border: "rgba(59,122,181,0.24)" },
  gold: { fg: "#a87c2a", bg: "rgba(192,149,96,0.12)", border: "rgba(192,149,96,0.28)" },
};

function TimelineRow({
  time,
  initials,
  name,
  service,
  statusLabel,
  tone,
  href,
  last,
}: {
  time: string;
  initials: string;
  name: string;
  service: string;
  statusLabel: string;
  tone: ToneKey;
  href: string;
  last: boolean;
}) {
  const c = TONE_HEX[tone];
  return (
    <Link href={href} className="group relative flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-background-alt">
      <div className="relative flex w-12 shrink-0 flex-col items-center pt-0.5">
        <span className="display-num text-sm font-bold" style={{ color: "var(--primary)" }}>
          {time}
        </span>
        <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: c.fg, boxShadow: `0 0 0 3px ${c.bg}` }} />
        {!last && (
          <span
            aria-hidden
            className="mt-1 w-px flex-1"
            style={{ background: "linear-gradient(to bottom, rgba(172,92,127,0.28), transparent)" }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 pb-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#c76f93,#92609f)" }}
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-bold">{name}</p>
          <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
            {service}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: c.fg, background: c.bg, border: `1px solid ${c.border}` }}
        >
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AttentionCard
// ══════════════════════════════════════════════════════════════════════════════

type AttentionColor = "green" | "warning" | "rose" | "info";

const ATTENTION_PALETTE: Record<
  AttentionColor,
  { bg: string; iconBg: string; iconColor: string; fg: string; border: string }
> = {
  green: { bg: "rgba(61,139,110,0.07)", iconBg: "rgba(61,139,110,0.14)", iconColor: "#3d8b6e", fg: "#2d6b55", border: "rgba(61,139,110,0.2)" },
  warning: { bg: "rgba(184,150,10,0.07)", iconBg: "rgba(184,150,10,0.15)", iconColor: "#b87c1e", fg: "#7a6400", border: "rgba(184,150,10,0.22)" },
  rose: { bg: "rgba(190,74,74,0.07)", iconBg: "rgba(190,74,74,0.14)", iconColor: "#be4a4a", fg: "#8b3333", border: "rgba(190,74,74,0.2)" },
  info: { bg: "rgba(59,122,181,0.07)", iconBg: "rgba(59,122,181,0.14)", iconColor: "#3b7ab5", fg: "#2a5a8a", border: "rgba(59,122,181,0.2)" },
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
      className="lift flex cursor-pointer items-center gap-3 rounded-2xl p-3.5"
      style={{ background: p.bg, border: `1px solid ${p.border}` }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: p.iconBg }}>
        <Icon className="h-4 w-4" style={{ color: p.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight" style={{ color: p.fg }}>
          {count !== "" && count !== undefined ? `${count} ` : ""}
          {label}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: p.fg, opacity: 0.75 }}>
          {subLabel}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: p.iconColor }}>
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
    <div className="aura-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground font-display text-sm font-bold tracking-tight">מבט על השבוע</h3>
        <Link
          href="/bookings/new"
          className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "rgba(172,92,127,0.10)", color: "var(--primary)" }}
        >
          + הוספת משבצת
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {slots.map((slot) => (
          <div
            key={slot.dayStr}
            className="flex flex-col items-center gap-1 rounded-2xl py-3"
            style={
              slot.isToday
                ? { background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)", boxShadow: "0 8px 18px -6px rgba(172,92,127,0.45)" }
                : { background: "rgba(247,238,243,0.5)", border: "1px solid rgba(172,92,127,0.08)" }
            }
          >
            <span className="text-xs font-semibold" style={{ color: slot.isToday ? "rgba(255,255,255,0.85)" : "var(--muted)" }}>
              {slot.label}
            </span>
            <span className="display-num text-lg font-bold" style={{ color: slot.isToday ? "#fff" : "var(--foreground)" }}>
              {slot.count}
            </span>
            <span className="text-[10px]" style={{ color: slot.isToday ? "rgba(255,255,255,0.6)" : "var(--muted-light)" }}>
              תורים
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/bookings"
        className="mt-3 flex items-center gap-1.5 pt-3 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ borderTop: "1px solid rgba(172,92,127,0.12)", color: "var(--primary)" }}
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
    <div className="aura-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-foreground font-display text-sm font-bold tracking-tight">לקוחות למעקב ושימור</h3>
        {clients.length > 3 && (
          <Link href="/bring-back" className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--primary)" }}>
            <span>הכול</span>
            <ArrowLeft className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="editorial-rule mx-5" />

      {clients.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm" style={{ color: "var(--muted)" }}>אין לקוחות למעקב כרגע</p>
          <Link href="/bring-back" className="mt-2 inline-block text-xs font-semibold transition-opacity hover:opacity-80" style={{ color: "var(--primary)" }}>
            מעבר להחזרת לקוחות
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {displayed.map((client) => {
            const days = daysSince(client.lastVisitAtISO);
            return (
              <div
                key={client.id}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center"
                style={{ background: "rgba(247,238,243,0.45)", border: "1px solid rgba(172,92,127,0.1)" }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#c76f93,#92609f)" }}
                >
                  {getInitial(client.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-bold">{client.fullName}</p>
                  {days !== null && (
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                      לא חזרה {days} ימים
                    </p>
                  )}
                </div>
                <Link
                  href="/bring-back"
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(37,211,102,0.1)", color: "#1a9e4e", border: "1px solid rgba(37,211,102,0.18)" }}
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>הודעה</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SetupProgressRibbon — slim progress strip
// ══════════════════════════════════════════════════════════════════════════════

function SetupProgressRibbon({ setup }: { setup: SetupState }) {
  const items = buildChecklist(setup);
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  if (progressPct === 100) return null;

  return (
    <div className="aura-card rounded-2xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: "linear-gradient(135deg,#c76f93,#92609f)" }}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-foreground font-display text-sm font-bold tracking-tight">{DASHBOARD.progress.title}</h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {completedCount}/{totalCount} הושלמו · {progressPct}%
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-transform hover:-translate-y-0.5"
              style={{
                background: item.done ? "rgba(61,139,110,0.08)" : "rgba(255,255,255,0.7)",
                border: `1px solid ${item.done ? "rgba(61,139,110,0.2)" : "rgba(172,92,127,0.16)"}`,
                color: item.done ? "#2f7d61" : "var(--foreground-soft)",
              }}
            >
              {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 opacity-60" />}
              <span className={item.done ? "line-through opacity-70" : ""}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(172,92,127,0.1)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #c76f93 0%, #ac5c7f 100%)" }}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Opportunity action link (button-styled CTA inside BeautyInsightCard)
// ══════════════════════════════════════════════════════════════════════════════

function OpportunityCta({ href, label, tone }: { href: string; label: string; tone: ToneKey }) {
  const c = TONE_HEX[tone];
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-transform hover:-translate-y-0.5"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span>{label}</span>
      <ArrowLeft className="h-3 w-3" />
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main export — SetupChecklist (dashboard)
// ══════════════════════════════════════════════════════════════════════════════

export function SetupChecklist({
  businessName,
  metrics,
  setup,
  todayBookings,
  upcomingBookings,
  guidanceItems = [],
  emptySlots = [],
  suggestedClients = [],
  atRiskCount = 0,
  remindersDueCount = 0,
  waitlistCount = 0,
  forecast,
  reviewReadyCount = 0,
  recentRuns = [],
}: {
  businessName: string;
  metrics: DashboardMetrics;
  setup: SetupState;
  todayBookings: UpcomingBookingItem[];
  upcomingBookings: UpcomingBookingItem[];
  guidanceItems?: GuidanceItem[];
  emptySlots?: EmptySlot[];
  suggestedClients?: SuggestedClient[];
  atRiskCount?: number;
  remindersDueCount?: number;
  waitlistCount?: number;
  forecast: RevenueForecastData;
  reviewReadyCount?: number;
  recentRuns?: RecentAutomationRun[];
}) {
  // Urgent guidance items not already covered by dedicated attention cards
  const extraUrgent = guidanceItems.filter(
    (item) =>
      item.priority === "important" &&
      item.id !== "today-bookings" &&
      item.id !== "no-upcoming-bookings",
  );

  const hasTodayAttention = extraUrgent.length > 0;

  return (
    <PremiumPageShell
      tint="blush"
      width="xwide"
      gap="default"
      className="-mt-2 space-y-6 md:-mt-3 md:space-y-7"
    >
      {/* Dashboard header — hero + quick actions + "היום" read as one
          continuous, compact header area (single FadeIn keeps them visually
          connected instead of floating apart). */}
      <FadeIn>
        <div className="space-y-5">
          <div className="space-y-3.5">
            <CommandCenterHero
              businessName={businessName}
              metrics={metrics}
            />
            <DashboardQuickActions />
          </div>

          {/* ── היום ── primary working area: appointments + side rail */}
          <section className="space-y-4">
            <EditorialSectionHeader
              eyebrow="המוקד היומי"
              title="היום"
              description="הפגישות והפעולות שדורשות אותך עכשיו"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              tint="blush"
            />
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TodayAppointmentsPanel todayBookings={todayBookings} />
            </div>
            <div className="space-y-3 lg:col-span-2">
              <p className="eyebrow" style={{ color: "var(--muted)" }}>
                דורש את תשומת הלב שלך
              </p>
              <div className="space-y-2.5">
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
                {!hasTodayAttention && (
                  <AttentionCard
                    count=""
                    label="הכול תחת שליטה"
                    subLabel="אין משימות דחופות — אפשר להתמקד בצמיחה"
                    action="להזדמנויות"
                    href="/bring-back"
                    icon={CheckCircle2}
                    color="green"
                    ariaLabel="אין משימות דחופות — מעבר להזדמנויות"
                  />
                )}
              </div>
              <WeekCalendarMini allBookings={[...todayBookings, ...upcomingBookings]} />
            </div>
          </div>
          </section>
        </div>
      </FadeIn>

      {/* ── הכנסות ── */}
      <FadeIn delay={0.1}>
        <section className="space-y-4">
          <EditorialSectionHeader
            eyebrow="הכסף שלך"
            title="הכנסות"
            description="ההכנסה החודש, הצפי לסוף החודש והפער ליעד"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            tint="champagne"
            action={
              <Link
                href="/finance"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--primary)" }}
              >
                פירוט מלא
                <ArrowLeft className="h-3 w-3" />
              </Link>
            }
          />
          <RevenueSection forecast={forecast} />
        </section>
      </FadeIn>

      {/* ── הזדמנויות ── */}
      <FadeIn delay={0.13}>
        <section className="space-y-4">
          <EditorialSectionHeader
            eyebrow="צמיחה"
            title="הזדמנויות"
            description="פעולות פשוטות שיגדילו את ההכנסה"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            tint="rose"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BeautyInsightCard
              tone="danger"
              featured
              icon={<RefreshCcw className="h-6 w-6" />}
              eyebrow="שימור לקוחות"
              title="לקוחות שלא חזרו"
              value={atRiskCount > 0 ? atRiskCount : "0"}
              valueLabel={atRiskCount > 0 ? "לקוחות" : "הכול מעודכן"}
              body={atRiskCount > 0 ? "לקוחות שלא חזרו זמן מה ומחכות לפנייה אישית" : "כל הלקוחות חזרו לאחרונה"}
              action={<OpportunityCta href="/bring-back" label="להחזרת לקוחות" tone="danger" />}
            />
            <BeautyInsightCard
              tone="success"
              featured
              icon={<CalendarRange className="h-6 w-6" />}
              eyebrow="זמן פנוי"
              title="חלונות פנויים"
              value={emptySlots.length > 0 ? emptySlots.length : "—"}
              valueLabel="חלונות"
              body={emptySlots.length > 0 ? "זמן פנוי השבוע שאפשר למלא עם לקוחות מתאימות" : "אין חלונות פנויים השבוע"}
              action={<OpportunityCta href="/bring-back?tab=slots" label="למילוי שעות ריקות" tone="success" />}
            />
            <BeautyInsightCard
              tone="brand"
              icon={<Star className="h-5 w-5" />}
              eyebrow="מוניטין"
              title="בקשות ביקורת"
              value={reviewReadyCount > 0 ? reviewReadyCount : "—"}
              valueLabel="מוכנות"
              body="טיפולים שהושלמו ומוכנים לבקשת ביקורת או הודעת תודה"
              action={<OpportunityCta href="/bring-back?tab=reviews" label="לבקשות ביקורת" tone="brand" />}
            />
            {waitlistCount > 0 ? (
              <BeautyInsightCard
                tone="brand"
                icon={<Clock className="h-5 w-5" />}
                eyebrow="רשימת המתנה"
                title="ממתינות ברשימת המתנה"
                value={waitlistCount}
                valueLabel="לקוחות"
                body="לקוחות שמחכות לתור מוקדם יותר — אפשר להציע להן כשמתפנה תור"
                action={<OpportunityCta href="/waitlist" label="לרשימת ההמתנה" tone="brand" />}
              />
            ) : (
              <BeautyInsightCard
                tone="info"
                icon={<UserPlus className="h-5 w-5" />}
                eyebrow="לקוחות"
                title="הוספת לקוחה חדשה"
                value="+"
                valueLabel="לקוחה"
                body="כל לקוחה חדשה היא הזדמנות לתור חוזר — הוסיפי אותן למערכת"
                action={<OpportunityCta href="/clients" label="לניהול לקוחות" tone="info" />}
              />
            )}
          </div>

          {suggestedClients.length > 0 && <FollowUpClientsPreview clients={suggestedClients} />}
        </section>
      </FadeIn>

      {/* ── התראות WhatsApp ── */}
      <FadeIn delay={0.16}>
        <section className="space-y-4">
          <EditorialSectionHeader
            eyebrow="על טייס אוטומטי"
            title="התראות WhatsApp"
            description="Allura שולחת ללקוחות שלך הודעות חשובות באופן אוטומטי"
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            tint="sage"
          />
          <AutomationsSection
            remindersDueCount={remindersDueCount}
            recentRuns={recentRuns}
          />
        </section>
      </FadeIn>

      <SetupProgressRibbon setup={setup} />
    </PremiumPageShell>
  );
}
