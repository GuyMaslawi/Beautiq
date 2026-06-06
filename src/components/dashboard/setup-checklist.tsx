"use client";

import Link from "next/link";
import {
  CalendarDays,
  Users2,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowLeft,
} from "lucide-react";
import { DASHBOARD, BOOKING_STATUS } from "@/lib/constants/he";
import { Card } from "@/components/ui/card";
import { StaggerIn, StaggerItem, FadeIn } from "@/components/ui/animate";
import {
  PendingDepositsPanel,
  type PendingDepositItem,
} from "@/components/dashboard/pending-deposits-panel";
import { BusinessGuidance } from "@/components/dashboard/business-guidance";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { GuidanceItem } from "@/lib/guidance/rules";

// ---------------------------------------------------------------------------
// Checklist builder
// ---------------------------------------------------------------------------

interface ChecklistItem {
  label: string;
  href: string;
  done: boolean;
}

function buildChecklist(setup: SetupState): ChecklistItem[] {
  return [
    {
      label: DASHBOARD.progress.items.categories,
      href: "/settings",
      done: setup.hasCategories,
    },
    {
      label: DASHBOARD.progress.items.service,
      href: "/services/new",
      done: setup.hasActiveService,
    },
    {
      label: DASHBOARD.progress.items.availability,
      href: "/availability",
      done: setup.hasAvailabilityRule,
    },
    {
      label: DASHBOARD.progress.items.profile,
      href: "/settings",
      done: setup.hasProfileDetails,
    },
    {
      label: DASHBOARD.progress.items.publicLink,
      href: "/settings",
      done: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Date / time formatting for upcoming bookings (server-side, Jerusalem tz)
// ---------------------------------------------------------------------------

const TZ = "Asia/Jerusalem";

function formatUpcomingDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: TZ },
  );
  const bookingStr = date.toLocaleDateString("en-CA", { timeZone: TZ });

  const timeStr = date.toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (bookingStr === todayStr) return `${DASHBOARD.upcoming.today}, ${timeStr}`;
  if (bookingStr === tomorrowStr)
    return `${DASHBOARD.upcoming.tomorrow}, ${timeStr}`;

  const dayStr = date.toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${dayStr}, ${timeStr}`;
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

type MetricIcon = typeof CalendarDays;

function MetricCard({
  title,
  value,
  hint,
  accent = false,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  accent?: boolean;
  icon: MetricIcon;
}) {
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-md"
      style={
        accent
          ? {
              background: "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)",
              border: "1px solid rgba(184,107,140,0.22)",
              boxShadow: "0 2px 8px rgba(184,107,140,0.10)",
            }
          : {
              background: "#fff",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }
      }
    >
      {/* Decorative gradient orb */}
      {accent && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,120,152,0.18) 0%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
      )}

      {/* Icon */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={
          accent
            ? { background: "rgba(184,107,140,0.14)" }
            : { background: "rgba(43,37,48,0.06)" }
        }
      >
        <Icon
          className="h-4.5 w-4.5"
          style={{ color: accent ? "#b86b8c" : "#8a8190" }}
        />
      </div>

      <div>
        <p
          className="text-3xl font-bold tracking-tight"
          style={{ color: accent ? "#b86b8c" : "#2b2530" }}
        >
          {value}
        </p>
        <p className="mt-1 text-xs font-medium" style={{ color: "#8a8190" }}>
          {title}
        </p>
      </div>

      <p className="text-xs leading-5" style={{ color: "#bbb3c2" }}>
        {hint}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SetupChecklist({
  businessName,
  metrics,
  setup,
  upcomingBookings,
  pendingDeposits = [],
  guidanceItems = [],
}: {
  businessName: string;
  metrics: DashboardMetrics;
  setup: SetupState;
  upcomingBookings: UpcomingBookingItem[];
  pendingDeposits?: PendingDepositItem[];
  guidanceItems?: GuidanceItem[];
}) {
  const items = buildChecklist(setup);
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const monthRevenueDisplay =
    metrics.monthRevenue > 0 ? formatILS(metrics.monthRevenue) : "₪0";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* 1. Welcome hero */}
      <FadeIn>
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-6"
          style={{
            background: "linear-gradient(135deg, rgba(201,120,152,0.08) 0%, rgba(184,107,140,0.04) 60%, transparent 100%)",
            border: "1px solid rgba(184,107,140,0.18)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Decorative glow */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: -40,
              left: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(201,120,152,0.15) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div className="relative space-y-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "rgba(184,107,140,0.12)", color: "#b86b8c" }}
            >
              <Sparkles className="h-3 w-3" />
              {DASHBOARD.welcome.badge}
            </span>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">
              {DASHBOARD.welcome.titlePrefix}{" "}
              <span style={{ color: "#b86b8c" }}>{businessName}</span>
            </h1>
            <p className="text-muted max-w-xl text-sm leading-7">
              {DASHBOARD.welcome.subtitle}
            </p>
            <p className="text-muted text-xs">{DASHBOARD.welcome.note}</p>
          </div>
        </div>
      </FadeIn>

      {/* 2. Metric cards */}
      <StaggerIn className="grid grid-cols-2 gap-4 md:grid-cols-4" delay={0.05}>
        <StaggerItem>
          <MetricCard
            title={DASHBOARD.metrics.bookingsToday}
            value={String(metrics.bookingsToday)}
            hint={
              metrics.bookingsToday === 0
                ? DASHBOARD.metrics.bookingsTodayHint
                : metrics.bookingsToday === 1
                  ? "תור אחד פעיל היום"
                  : `${metrics.bookingsToday} תורים פעילים היום`
            }
            accent={metrics.bookingsToday > 0}
            icon={CalendarDays}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            title={DASHBOARD.metrics.clients}
            value={String(metrics.totalClients)}
            hint={
              metrics.totalClients === 0
                ? DASHBOARD.metrics.clientsEmpty
                : DASHBOARD.metrics.clientsHint
            }
            icon={Users2}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            title={DASHBOARD.metrics.services}
            value={String(metrics.activeServices)}
            hint={
              metrics.activeServices === 0
                ? DASHBOARD.metrics.servicesEmpty
                : DASHBOARD.metrics.servicesHint
            }
            icon={Sparkles}
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            title={DASHBOARD.metrics.monthRevenue}
            value={monthRevenueDisplay}
            hint={DASHBOARD.metrics.monthRevenueHint}
            accent={metrics.monthRevenue > 0}
            icon={TrendingUp}
          />
        </StaggerItem>
      </StaggerIn>

      {/* 3. Pending deposits */}
      {pendingDeposits.length > 0 && (
        <FadeIn delay={0.1}>
          <PendingDepositsPanel items={pendingDeposits} />
        </FadeIn>
      )}

      {/* 4. Setup progress checklist */}
      <FadeIn delay={0.12}>
        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-foreground font-bold">
                {DASHBOARD.progress.title}
              </h2>
              <p className="text-muted mt-0.5 text-xs">
                {completedCount} {DASHBOARD.progress.completedOf} {totalCount}
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
              style={{
                background:
                  progressPct === 100
                    ? "rgba(61,139,110,0.10)"
                    : "rgba(184,107,140,0.10)",
                color: progressPct === 100 ? "#3d8b6e" : "#b86b8c",
              }}
            >
              {progressPct}%
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mb-5 h-1.5 overflow-hidden rounded-full"
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

          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="hover:bg-background-alt flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors group"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.done ? (
                      <CheckCircle2
                        className="h-5 w-5 shrink-0"
                        style={{ color: "#3d8b6e" }}
                      />
                    ) : (
                      <Circle
                        className="h-5 w-5 shrink-0"
                        style={{ color: "var(--muted-light)" }}
                      />
                    )}
                    <span
                      className={`truncate text-sm font-medium ${item.done ? "text-muted line-through" : "text-foreground"}`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={
                        item.done
                          ? { background: "rgba(61,139,110,0.10)", color: "#3d8b6e" }
                          : { background: "rgba(43,37,48,0.05)", color: "#8a8190" }
                      }
                    >
                      {item.done ? "הושלם" : DASHBOARD.progress.soon}
                    </span>
                    {!item.done && (
                      <ArrowLeft className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </FadeIn>

      {/* 5. Business guidance */}
      <FadeIn delay={0.14}>
        <BusinessGuidance items={guidanceItems} />
      </FadeIn>

      {/* 6. Upcoming bookings */}
      <FadeIn delay={0.16}>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4.5 w-4.5" style={{ color: "#b86b8c" }} />
            <h2 className="text-foreground font-bold">
              {DASHBOARD.upcoming.title}
            </h2>
          </div>
          {upcomingBookings.length === 0 ? (
            <p className="text-muted text-sm">{DASHBOARD.upcoming.empty}</p>
          ) : (
            <ul className="divide-border divide-y">
              {upcomingBookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="hover:bg-background-alt flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-semibold">
                        {booking.clientName}
                      </p>
                      <p className="text-muted mt-0.5 truncate text-xs">
                        {booking.serviceName}
                        {" · "}
                        {formatUpcomingDate(booking.startTimeISO)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={
                        booking.status === "approved"
                          ? { background: "rgba(184,107,140,0.10)", color: "#b86b8c" }
                          : { background: "rgba(184,150,10,0.10)", color: "#7a6400" }
                      }
                    >
                      {BOOKING_STATUS[booking.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}
