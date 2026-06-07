"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  Users2,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Clock,
  CreditCard,
  Zap,
} from "lucide-react";
import { DASHBOARD, BOOKING_STATUS, GUIDANCE } from "@/lib/constants/he";
import { Card } from "@/components/ui/card";
import { StaggerIn, StaggerItem, FadeIn } from "@/components/ui/animate";
import {
  PendingDepositsPanel,
  type PendingDepositItem,
} from "@/components/dashboard/pending-deposits-panel";
import { GuidanceCard } from "@/components/dashboard/guidance-card";
import {
  EmptySlotsSection,
} from "@/components/dashboard/empty-slots-section";
import type {
  DashboardMetrics,
  SetupState,
  UpcomingBookingItem,
} from "@/server/dashboard/queries";
import type { GuidanceItem } from "@/lib/guidance/rules";
import type { EmptySlot } from "@/lib/empty-slots/find-empty-slots";
import type { SuggestedClient } from "@/server/empty-slots/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChecklistItem {
  label: string;
  href: string;
  done: boolean;
}

function buildChecklist(setup: SetupState): ChecklistItem[] {
  return [
    { label: DASHBOARD.progress.items.categories, href: "/settings", done: setup.hasCategories },
    { label: DASHBOARD.progress.items.service, href: "/services/new", done: setup.hasActiveService },
    { label: DASHBOARD.progress.items.availability, href: "/availability", done: setup.hasAvailabilityRule },
    { label: DASHBOARD.progress.items.profile, href: "/settings", done: setup.hasProfileDetails },
    { label: DASHBOARD.progress.items.publicLink, href: "/settings", done: true },
  ];
}

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

const TZ = "Asia/Jerusalem";

function formatUpcomingDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const tomorrowStr = new Date(now.getTime() + 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  const bookingStr = date.toLocaleDateString("en-CA", { timeZone: TZ });
  const timeStr = date.toLocaleTimeString("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (bookingStr === todayStr) return `${DASHBOARD.upcoming.today}, ${timeStr}`;
  if (bookingStr === tomorrowStr) return `${DASHBOARD.upcoming.tomorrow}, ${timeStr}`;
  const dayStr = date.toLocaleDateString("he-IL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${dayStr}, ${timeStr}`;
}

// ---------------------------------------------------------------------------
// Quick stat chip in the hero
// ---------------------------------------------------------------------------

function StatChip({
  children,
  urgent = false,
  href,
}: {
  children: ReactNode;
  urgent?: boolean;
  href?: string;
}) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80";
  const style: React.CSSProperties = urgent
    ? {
        background: "rgba(184,124,30,0.13)",
        color: "#7a6400",
        border: "1px solid rgba(184,124,30,0.22)",
      }
    : {
        background: "rgba(184,107,140,0.12)",
        color: "#b86b8c",
        border: "1px solid rgba(184,107,140,0.20)",
      };

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero command center
// ---------------------------------------------------------------------------

function HeroSection({
  businessName,
  metrics,
  pendingDepositsCount,
  pendingApprovalCount,
  emptySlotCount,
  progressPct,
}: {
  businessName: string;
  metrics: DashboardMetrics;
  pendingDepositsCount: number;
  pendingApprovalCount: number;
  emptySlotCount: number;
  progressPct: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-7 py-7"
      style={{
        background:
          "linear-gradient(135deg, rgba(201,120,152,0.13) 0%, rgba(184,107,140,0.07) 55%, rgba(250,247,245,0) 100%)",
        border: "1px solid rgba(184,107,140,0.22)",
        boxShadow: "0 2px 20px rgba(184,107,140,0.09)",
      }}
    >
      {/* Decorative glow orb */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: -60,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(201,120,152,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative space-y-3">
        {progressPct < 100 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(184,107,140,0.12)", color: "#b86b8c" }}
          >
            <Sparkles className="h-3 w-3" />
            {DASHBOARD.progress.title}
          </span>
        )}

        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            שלום,{" "}
            <span style={{ color: "#b86b8c" }}>{businessName}</span>
          </h1>
          <p className="text-muted mt-1 max-w-sm text-sm leading-7">
            Beautiq מסדרת לך את היום — תורים, לקוחות וכל מה שדורש תשומת לב.
          </p>
        </div>

        {/* Quick stat chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {metrics.bookingsToday > 0 && (
            <StatChip href="/bookings?filter=today">
              <CalendarDays className="h-3.5 w-3.5" />
              {metrics.bookingsToday === 1
                ? "תור אחד היום"
                : `${metrics.bookingsToday} תורים היום`}
            </StatChip>
          )}
          {pendingApprovalCount > 0 && (
            <StatChip href="/bookings" urgent>
              <Clock className="h-3.5 w-3.5" />
              {pendingApprovalCount === 1
                ? "תור אחד ממתין לאישור"
                : `${pendingApprovalCount} ממתינים לאישור`}
            </StatChip>
          )}
          {pendingDepositsCount > 0 && (
            <StatChip urgent>
              <CreditCard className="h-3.5 w-3.5" />
              {pendingDepositsCount === 1
                ? "מקדמה ממתינה אחת"
                : `${pendingDepositsCount} מקדמות ממתינות`}
            </StatChip>
          )}
          {emptySlotCount > 0 && (
            <StatChip>
              <CalendarRange className="h-3.5 w-3.5" />
              {emptySlotCount === 1
                ? "חלון פנוי אחד"
                : `${emptySlotCount} חלונות פנויים`}
            </StatChip>
          )}
        </div>
      </div>
    </div>
  );
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
              background:
                "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)",
              border: "1px solid rgba(184,107,140,0.22)",
              boxShadow: "0 2px 10px rgba(184,107,140,0.10)",
            }
          : {
              background: "#fff",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }
      }
    >
      {accent && (
        <div
          className="pointer-events-none absolute"
          style={{
            top: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(201,120,152,0.18) 0%, transparent 70%)",
            filter: "blur(12px)",
          }}
        />
      )}

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
  emptySlots = [],
  suggestedClients = [],
}: {
  businessName: string;
  metrics: DashboardMetrics;
  setup: SetupState;
  upcomingBookings: UpcomingBookingItem[];
  pendingDeposits?: PendingDepositItem[];
  guidanceItems?: GuidanceItem[];
  emptySlots?: EmptySlot[];
  suggestedClients?: SuggestedClient[];
}) {
  const items = buildChecklist(setup);
  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const monthRevenueDisplay =
    metrics.monthRevenue > 0 ? formatILS(metrics.monthRevenue) : "₪0";

  // Separate urgent vs. non-urgent guidance
  // Skip the pending-deposits item since PendingDepositsPanel handles it with better detail
  const urgentGuidance = guidanceItems.filter(
    (i) => i.priority === "important" && i.id !== "pending-deposits",
  );
  const nonUrgentGuidance = guidanceItems.filter((i) => i.priority !== "important");

  const pendingApprovalCount = upcomingBookings.filter(
    (b) => b.status === "pending",
  ).length;

  const hasUrgentSection =
    urgentGuidance.length > 0 || pendingDeposits.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">

      {/* A. Hero command center */}
      <FadeIn>
        <HeroSection
          businessName={businessName}
          metrics={metrics}
          pendingDepositsCount={pendingDeposits.length}
          pendingApprovalCount={pendingApprovalCount}
          emptySlotCount={emptySlots.length}
          progressPct={progressPct}
        />
      </FadeIn>

      {/* B. "Requires attention now" — urgent items only */}
      {hasUrgentSection && (
        <FadeIn delay={0.04}>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "rgba(184,124,30,0.12)" }}
              >
                <Zap className="h-3.5 w-3.5" style={{ color: "#b87c1e" }} />
              </div>
              <h2
                className="text-sm font-bold tracking-wide"
                style={{ color: "#7a6400" }}
              >
                דורש טיפול עכשיו
              </h2>
            </div>

            <div className="space-y-3">
              {urgentGuidance.map((item) => (
                <GuidanceCard key={item.id} item={item} />
              ))}
              {pendingDeposits.length > 0 && (
                <PendingDepositsPanel items={pendingDeposits} />
              )}
            </div>
          </section>
        </FadeIn>
      )}

      {/* C. Metric snapshot */}
      <StaggerIn className="grid grid-cols-2 gap-4 md:grid-cols-4" delay={0.06}>
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

      {/* D. Non-urgent guidance */}
      {nonUrgentGuidance.length > 0 && (
        <FadeIn delay={0.08}>
          <section>
            <h2 className="text-foreground mb-3 font-bold">
              {GUIDANCE.sectionTitle}
            </h2>
            <div className="space-y-3">
              {nonUrgentGuidance.map((item) => (
                <GuidanceCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* All-clear state when no guidance at all */}
      {guidanceItems.length === 0 && (
        <FadeIn delay={0.08}>
          <div
            className="rounded-2xl border p-5 space-y-1"
            style={{
              borderColor: "rgba(61,139,110,0.22)",
              background: "rgba(61,139,110,0.05)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                style={{ background: "rgba(61,139,110,0.14)", color: "#3d8b6e" }}
              >
                ✓
              </span>
              <p className="text-foreground font-semibold text-sm">
                {GUIDANCE.allClear.title}
              </p>
            </div>
            <p className="text-muted text-sm leading-6 pr-9">
              {GUIDANCE.allClear.body}
            </p>
          </div>
        </FadeIn>
      )}

      {/* E. Empty slots */}
      <FadeIn delay={0.10}>
        <EmptySlotsSection
          slots={emptySlots}
          suggestedClients={suggestedClients}
          hasServicesAndAvailability={
            setup.hasActiveService && setup.hasAvailabilityRule
          }
        />
      </FadeIn>

      {/* F. Upcoming bookings */}
      <FadeIn delay={0.12}>
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "rgba(184,107,140,0.12)" }}
            >
              <CalendarDays
                className="h-4 w-4"
                style={{ color: "#b86b8c" }}
              />
            </div>
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
                          ? {
                              background: "rgba(184,107,140,0.10)",
                              color: "#b86b8c",
                            }
                          : {
                              background: "rgba(184,150,10,0.10)",
                              color: "#7a6400",
                            }
                      }
                    >
                      {BOOKING_STATUS[booking.status as keyof typeof BOOKING_STATUS] ?? booking.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </FadeIn>

      {/* G. Setup checklist — at the bottom, hidden when 100% done */}
      {progressPct < 100 && (
        <FadeIn delay={0.14}>
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
                  background: "rgba(184,107,140,0.10)",
                  color: "#b86b8c",
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
                  background:
                    "linear-gradient(90deg, #c97898 0%, #b86b8c 100%)",
                }}
              />
            </div>

            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="hover:bg-background-alt group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors"
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
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={
                          item.done
                            ? {
                                background: "rgba(61,139,110,0.10)",
                                color: "#3d8b6e",
                              }
                            : {
                                background: "rgba(43,37,48,0.05)",
                                color: "#8a8190",
                              }
                        }
                      >
                        {item.done ? "הושלם" : DASHBOARD.progress.soon}
                      </span>
                      {!item.done && (
                        <ArrowLeft className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
