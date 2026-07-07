import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  AlertCircle,
  Calendar,
  ChevronLeft,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { requireCurrentBusiness } from "@/server/auth/session";
import { getRevenueForecastData } from "@/server/revenue-forecast/queries";
import { REVENUE_FORECAST } from "@/lib/constants/he";
import { PremiumPageShell, BeautyPageHero, PremiumEmptyState } from "@/components/premium";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("he-IL")}`;
}

// ---------------------------------------------------------------------------
// Hero card
// ---------------------------------------------------------------------------

function HeroCard({
  expectedRevenue,
  gapToTarget,
  isOnTrack,
  actualProgressPct,
  expectedProgressPct,
  daysPassed,
  totalDays,
  confidence,
  hasEnoughData,
  targetReliable,
}: {
  expectedRevenue: number;
  gapToTarget: number;
  isOnTrack: boolean;
  actualProgressPct: number;
  expectedProgressPct: number;
  daysPassed: number;
  totalDays: number;
  confidence: "high" | "medium" | "low";
  hasEnoughData: boolean;
  targetReliable: boolean;
}) {
  const confidenceColors = {
    high: { bg: "rgba(61,139,110,0.20)", text: "#7ee8b8", border: "rgba(61,139,110,0.30)" },
    medium: { bg: "rgba(212,168,30,0.20)", text: "#f5c842", border: "rgba(212,168,30,0.30)" },
    low: { bg: "rgba(255,255,255,0.12)", text: "rgba(255,255,255,0.60)", border: "rgba(255,255,255,0.20)" },
  };
  const conf = confidenceColors[confidence];

  return (
    <div
      className="relative overflow-hidden rounded-3xl px-7 py-8"
      style={{
        background: "linear-gradient(145deg, #2b0e1f 0%, #3e1630 55%, #2c1527 100%)",
        border: "1px solid rgba(172,92,127,0.28)",
        boxShadow: "0 8px 40px rgba(120,40,80,0.28), 0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 80% 10%, rgba(199,111,147,0.22) 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(212,168,83,0.12) 0%, transparent 50%)",
        }}
      />

      <div className="relative">
        {/* Top row: badge + confidence */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "rgba(212,168,83,0.18)", border: "1px solid rgba(212,168,83,0.30)" }}
            >
              <TrendingUp className="h-4.5 w-4.5" style={{ color: "#d4a853" }} />
            </div>
            <span className="text-sm font-semibold text-white">{REVENUE_FORECAST.pageTitle}</span>
          </div>
          <div
            className="flex flex-col items-end gap-1"
          >
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: conf.bg, color: conf.text, border: `1px solid ${conf.border}` }}
            >
              <span>{REVENUE_FORECAST.hero.confidence[confidence]}</span>
            </div>
            {confidence === "low" && (
              <p className="text-[11px] text-right leading-4" style={{ color: "rgba(255,255,255,0.40)" }}>
                {REVENUE_FORECAST.hero.lowConfidenceNote}
              </p>
            )}
          </div>
        </div>

        {/* Main number */}
        <div className="mb-2">
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
            {REVENUE_FORECAST.hero.expectedLabel}
          </p>
          <p
            className="text-5xl font-bold tabular-nums leading-none tracking-tight text-white"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
          >
            {formatILS(expectedRevenue)}
          </p>
        </div>

        {/* Gap / on track */}
        <div className="mb-6">
          {!hasEnoughData ? (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              {REVENUE_FORECAST.noTarget}
            </p>
          ) : isOnTrack && targetReliable ? (
            <p className="text-sm font-semibold" style={{ color: "#7ee8b8" }}>
              {REVENUE_FORECAST.hero.noGap}
            </p>
          ) : !targetReliable ? (
            <div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold me-1.5"
                  style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.60)" }}
                >
                  {REVENUE_FORECAST.hero.provisionalTarget}
                </span>
                {gapToTarget > 0
                  ? <>{REVENUE_FORECAST.hero.gapLabel}: <span className="font-bold text-white">{formatILS(gapToTarget)}</span></>
                  : <span style={{ color: "#7ee8b8" }}>{REVENUE_FORECAST.hero.noGap.replace("! 🎉", "")}</span>
                }
              </p>
              <p className="mt-1 text-[11px] leading-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                {REVENUE_FORECAST.hero.provisionalTargetNote}
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              {REVENUE_FORECAST.hero.gapLabel}:{" "}
              <span className="font-bold text-white">{formatILS(gapToTarget)}</span>
            </p>
          )}
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          {/* Actual progress — only show against target when target is reliable */}
          {targetReliable && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.60)" }}>
                  {REVENUE_FORECAST.hero.progressLabel}
                </span>
                <span className="text-xs font-bold tabular-nums text-white">{actualProgressPct}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${actualProgressPct}%`,
                    background: isOnTrack
                      ? "linear-gradient(90deg, #3d8b6e 0%, #7ee8b8 100%)"
                      : "linear-gradient(90deg, #c76f93 0%, #ac5c7f 100%)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Expected time progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                {REVENUE_FORECAST.dayProgress(daysPassed, totalDays)}
              </span>
              <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>
                {expectedProgressPct}%
              </span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${expectedProgressPct}%`,
                  background: "rgba(255,255,255,0.25)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

type MetricVariant = "default" | "rose" | "gold" | "green" | "red";

const METRIC_PALETTE: Record<
  MetricVariant,
  { bg: string; border: string; iconBg: string; iconColor: string; valueColor: string }
> = {
  default: {
    bg: "rgba(255,255,255,0.97)",
    border: "1px solid var(--border)",
    iconBg: "rgba(43,37,48,0.06)",
    iconColor: "#8a8190",
    valueColor: "var(--foreground)",
  },
  rose: {
    bg: "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)",
    border: "1px solid rgba(172,92,127,0.22)",
    iconBg: "rgba(172,92,127,0.14)",
    iconColor: "var(--primary)",
    valueColor: "var(--primary)",
  },
  gold: {
    bg: "linear-gradient(135deg, #fdf8ec 0%, #f7f0dc 100%)",
    border: "1px solid rgba(212,168,83,0.25)",
    iconBg: "rgba(212,168,83,0.15)",
    iconColor: "#c09560",
    valueColor: "#8a6010",
  },
  green: {
    bg: "linear-gradient(135deg, #f0faf5 0%, #e3f5ec 100%)",
    border: "1px solid rgba(61,139,110,0.20)",
    iconBg: "rgba(61,139,110,0.12)",
    iconColor: "#3d8b6e",
    valueColor: "#2d6b55",
  },
  red: {
    bg: "linear-gradient(135deg, #fff5f5 0%, #fdeaea 100%)",
    border: "1px solid rgba(190,74,74,0.20)",
    iconBg: "rgba(190,74,74,0.12)",
    iconColor: "#be4a4a",
    valueColor: "#8b2020",
  },
};

function MetricCard({
  title,
  value,
  note,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  note?: string;
  icon: React.ElementType;
  variant?: MetricVariant;
}) {
  const p = METRIC_PALETTE[variant];
  return (
    <div
      className="flex flex-col gap-3 overflow-hidden rounded-2xl p-4 transition-shadow hover:shadow-md"
      style={{ background: p.bg, border: p.border, boxShadow: "0 1px 6px rgba(43,37,48,0.06)" }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ background: p.iconBg }}
      >
        <Icon className="h-4 w-4" style={{ color: p.iconColor }} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: p.valueColor }}>
          {value}
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--muted)" }}>
          {title}
        </p>
        {note && (
          <p className="mt-1 text-[11px] leading-4" style={{ color: "var(--muted-light)" }}>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue timeline
// ---------------------------------------------------------------------------

function RevenueTimeline({
  completedRevenue,
  upcomingRevenue,
  gapToTarget,
  lostRevenue,
  monthlyTarget,
  targetReliable,
}: {
  completedRevenue: number;
  upcomingRevenue: number;
  gapToTarget: number;
  lostRevenue: number;
  monthlyTarget: number;
  targetReliable: boolean;
}) {
  const total = Math.max(completedRevenue + upcomingRevenue + gapToTarget, 1);

  const completedPct = Math.round((completedRevenue / total) * 100);
  const upcomingPct = Math.round((upcomingRevenue / total) * 100);
  const gapPct = Math.max(0, 100 - completedPct - upcomingPct);

  const segments = [
    { pct: completedPct, color: "#3d8b6e", label: REVENUE_FORECAST.timeline.completed, value: completedRevenue },
    { pct: upcomingPct, color: "var(--primary)", label: REVENUE_FORECAST.timeline.upcoming, value: upcomingRevenue },
    { pct: gapPct, color: "rgba(43,37,48,0.08)", label: REVENUE_FORECAST.timeline.gap, value: gapToTarget },
  ];

  return (
    <div className="aura-card rounded-[1.4rem] p-5">
      <h3 className="font-display mb-4 text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
        {REVENUE_FORECAST.timeline.title}
      </h3>

      {/* Stacked bar */}
      <div className="mb-4 flex h-5 overflow-hidden rounded-full">
        {segments.map((seg, i) =>
          seg.pct > 0 ? (
            <div
              key={i}
              className="transition-all duration-700"
              style={{ width: `${seg.pct}%`, background: seg.color, minWidth: seg.pct > 0 ? 4 : 0 }}
            />
          ) : null,
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {segments
          .filter((s) => s.value > 0)
          .map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: seg.color }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {seg.label}:{" "}
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                  {formatILS(seg.value)}
                </span>
              </span>
            </div>
          ))}
        {lostRevenue > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ background: "#be4a4a" }} />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {REVENUE_FORECAST.timeline.lost}:{" "}
              <span className="font-semibold" style={{ color: "#8b2020" }}>
                {formatILS(lostRevenue)}
              </span>
            </span>
          </div>
        )}
      </div>

      {monthlyTarget > 0 && (
        <p className="mt-3 text-xs" style={{ color: "var(--muted-light)" }}>
          {targetReliable ? "יעד חודשי" : "יעד זמני"}: {formatILS(monthlyTarget)}
          {!targetReliable && (
            <span className="me-1"> — {REVENUE_FORECAST.hero.provisionalTargetNote}</span>
          )}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action recommendations
// ---------------------------------------------------------------------------

interface ActionRec {
  text: string;
  action: string;
  href: string;
  color: "green" | "rose" | "gold" | "info";
}

function buildRecommendations(data: {
  gapToTarget: number;
  isOnTrack: boolean;
  emptySlotsCount: number;
  avgServicePrice: number;
  atRiskCount: number;
  hasEnoughData: boolean;
}): ActionRec[] {
  const recs: ActionRec[] = [];
  const RF = REVENUE_FORECAST.recommendations;

  if (data.emptySlotsCount > 0 && data.avgServicePrice > 0) {
    const estimate = data.emptySlotsCount * data.avgServicePrice;
    recs.push({
      text: RF.emptySlots(data.emptySlotsCount, estimate),
      action: RF.emptySlotsAction,
      href: RF.emptySlotsHref,
      color: "green",
    });
  }

  if (data.atRiskCount > 0) {
    recs.push({
      text: RF.atRisk(data.atRiskCount),
      action: RF.atRiskAction,
      href: RF.atRiskHref,
      color: "gold",
    });
  }

  if (data.gapToTarget > 0) {
    recs.push({
      text: RF.winBack,
      action: RF.winBackAction,
      href: RF.winBackHref,
      color: "info",
    });
  }

  return recs;
}

const REC_COLORS = {
  green: { bg: "rgba(61,139,110,0.07)", iconBg: "rgba(61,139,110,0.14)", iconColor: "#3d8b6e", fg: "#2d6b55", actionColor: "#3d8b6e" },
  rose: { bg: "rgba(190,74,74,0.07)", iconBg: "rgba(190,74,74,0.14)", iconColor: "#be4a4a", fg: "#8b3333", actionColor: "#be4a4a" },
  gold: { bg: "rgba(212,168,83,0.08)", iconBg: "rgba(212,168,83,0.15)", iconColor: "#c09560", fg: "#6a4200", actionColor: "#c09560" },
  info: { bg: "rgba(59,122,181,0.07)", iconBg: "rgba(59,122,181,0.14)", iconColor: "#3b7ab5", fg: "#2a5a8a", actionColor: "#3b7ab5" },
};

const REC_ICONS: Record<ActionRec["color"], React.ElementType> = {
  green: Calendar,
  rose: AlertCircle,
  gold: Sparkles,
  info: TrendingUp,
};

function RecommendationsSection({ recs }: { recs: ActionRec[] }) {
  return (
    <div className="aura-card rounded-[1.4rem] p-5">
      <h3 className="font-display mb-4 text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
        {REVENUE_FORECAST.recommendations.title}
      </h3>

      {recs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {REVENUE_FORECAST.recommendations.noActions}
        </p>
      ) : (
        <div className="space-y-2.5">
          {recs.map((rec, i) => {
            const colors = REC_COLORS[rec.color];
            const Icon = REC_ICONS[rec.color];
            return (
              <Link
                key={i}
                href={rec.href}
                className="flex cursor-pointer items-center gap-3 rounded-xl p-3.5 transition-opacity hover:opacity-90"
                style={{ background: colors.bg }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: colors.iconBg }}
                >
                  <Icon className="h-4 w-4" style={{ color: colors.iconColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 font-medium" style={{ color: colors.fg }}>
                    {rec.text}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1 text-xs font-semibold"
                  style={{ color: colors.actionColor }}
                >
                  <span className="hidden sm:inline">{rec.action}</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top services
// ---------------------------------------------------------------------------

function TopServicesSection({
  services,
}: {
  services: {
    id: string;
    name: string;
    bookingsCount: number;
    revenue: number;
    avgPrice: number;
  }[];
}) {
  if (services.length === 0) {
    return (
      <PremiumEmptyState
        tint="champagne"
        icon={<BarChart3 className="h-7 w-7" />}
        title={REVENUE_FORECAST.services.title}
        body={REVENUE_FORECAST.services.noServices}
      />
    );
  }

  const maxRevenue = services[0].revenue;

  return (
    <div className="aura-card overflow-hidden rounded-[1.4rem]">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {REVENUE_FORECAST.services.title}
        </h3>
      </div>

      <ul>
        {services.map((svc, idx) => {
          const pct = maxRevenue > 0 ? Math.round((svc.revenue / maxRevenue) * 100) : 0;
          const isLast = idx === services.length - 1;
          return (
            <li
              key={svc.id}
              className="px-5 py-3.5"
              style={!isLast ? { borderBottom: "1px solid var(--border)" } : undefined}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: idx === 0
                        ? "linear-gradient(135deg, #d4a853 0%, #c09560 100%)"
                        : "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <span className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {svc.name}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                  {formatILS(svc.revenue)}
                </span>
              </div>
              {/* Revenue bar */}
              <div
                className="mb-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: "rgba(172,92,127,0.10)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: idx === 0
                      ? "linear-gradient(90deg, #d4a853 0%, #c09560 100%)"
                      : "linear-gradient(90deg, #c76f93 0%, #ac5c7f 100%)",
                  }}
                />
              </div>
              <div className="flex gap-4 text-xs" style={{ color: "var(--muted)" }}>
                <span>{svc.bookingsCount} {REVENUE_FORECAST.services.bookingsCount}</span>
                <span>{REVENUE_FORECAST.services.avgPrice}: {formatILS(svc.avgPrice)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / low data state
// ---------------------------------------------------------------------------

function LowDataBanner() {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,248,253,0.95)",
        border: "1px solid rgba(172,92,127,0.18)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(172,92,127,0.12)" }}
        >
          <BarChart3 className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {REVENUE_FORECAST.emptyState.title}
          </p>
          <p className="mt-1 text-sm leading-5" style={{ color: "var(--muted)" }}>
            {REVENUE_FORECAST.emptyState.body}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RevenueForecastPage() {
  const business = await requireCurrentBusiness();
  const tenant = { businessId: business.id };

  const data = await getRevenueForecastData(tenant);

  const recommendations = buildRecommendations({
    gapToTarget: data.gapToTarget,
    isOnTrack: data.isOnTrack,
    emptySlotsCount: data.emptySlotsCount,
    avgServicePrice: data.avgServicePrice,
    atRiskCount: data.atRiskCount,
    hasEnoughData: data.hasEnoughData,
  });

  const showLowData = !data.hasEnoughData;

  return (
    <PremiumPageShell tint="champagne" width="narrow" className="pb-10">
      {/* Page header */}
      <BeautyPageHero
        icon={TrendingUp}
        eyebrow="Allura Pro"
        title={REVENUE_FORECAST.pageTitle}
        subtitle={REVENUE_FORECAST.pageSubtitle}
        tint="champagne"
        action={
          <Link
            href="/bookings"
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>תורים</span>
          </Link>
        }
        aside={
          <span
            className="self-start rounded-full px-2.5 py-1 text-[10px] font-bold md:self-end"
            style={{
              background: "linear-gradient(135deg, rgba(212,168,83,0.18) 0%, rgba(192,149,96,0.12) 100%)",
              color: "var(--accent)",
              border: "1px solid rgba(212,168,83,0.30)",
            }}
          >
            Pro
          </span>
        }
      />

      {/* Low data banner */}
      {showLowData && <LowDataBanner />}

      {/* Hero card */}
      <HeroCard
        expectedRevenue={data.expectedRevenue}
        gapToTarget={data.gapToTarget}
        isOnTrack={data.isOnTrack}
        actualProgressPct={data.actualProgressPct}
        expectedProgressPct={data.expectedProgressPct}
        daysPassed={data.daysPassed}
        totalDays={data.totalDays}
        confidence={data.confidence}
        hasEnoughData={data.hasEnoughData}
        targetReliable={data.targetReliable}
      />

      {/* 6 metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          title={REVENUE_FORECAST.metrics.completedRevenue}
          value={formatILS(data.completedRevenue)}
          note={REVENUE_FORECAST.metrics.completedRevenueNote}
          icon={TrendingUp}
          variant={data.completedRevenue > 0 ? "green" : "default"}
        />
        <MetricCard
          title={REVENUE_FORECAST.metrics.expectedRevenue}
          value={formatILS(data.expectedRevenue)}
          note={REVENUE_FORECAST.metrics.expectedRevenueNote}
          icon={Sparkles}
          variant="rose"
        />
        <MetricCard
          title={REVENUE_FORECAST.metrics.monthlyTarget}
          value={data.monthlyTarget > 0 ? formatILS(data.monthlyTarget) : "—"}
          note={
            data.targetReliable
              ? REVENUE_FORECAST.metrics.monthlyTargetNote
              : data.monthlyTarget > 0
                ? REVENUE_FORECAST.metrics.monthlyTargetProvisionalNote
                : REVENUE_FORECAST.metrics.noTargetYet
          }
          icon={Target}
          variant={data.targetReliable ? "gold" : "default"}
        />
        <MetricCard
          title={REVENUE_FORECAST.metrics.gapToTarget}
          value={data.isOnTrack ? "✓" : data.monthlyTarget > 0 ? formatILS(data.gapToTarget) : "—"}
          note={
            data.isOnTrack
              ? "הגעת ליעד! ✓"
              : data.monthlyTarget > 0 && !data.targetReliable
                ? REVENUE_FORECAST.metrics.gapToTargetNote + " (יעד זמני)"
                : data.monthlyTarget > 0
                  ? REVENUE_FORECAST.metrics.gapToTargetNote
                  : REVENUE_FORECAST.metrics.noTargetYet
          }
          icon={data.isOnTrack ? TrendingUp : TrendingDown}
          variant={data.isOnTrack ? "green" : data.monthlyTarget > 0 && data.gapToTarget > 0 ? "rose" : "default"}
        />
        <MetricCard
          title={REVENUE_FORECAST.metrics.avgBookingValue}
          value={data.avgBookingValue > 0 ? formatILS(data.avgBookingValue) : "—"}
          note={REVENUE_FORECAST.metrics.avgBookingValueNote}
          icon={BarChart3}
          variant={data.avgBookingValue > 0 ? "gold" : "default"}
        />
        <MetricCard
          title={REVENUE_FORECAST.metrics.lostRevenue}
          value={data.lostRevenue > 0 ? formatILS(data.lostRevenue) : "—"}
          note={REVENUE_FORECAST.metrics.lostRevenueNote}
          icon={TrendingDown}
          variant={data.lostRevenue > 0 ? "red" : "default"}
        />
      </div>

      {/* Revenue timeline */}
      <RevenueTimeline
        completedRevenue={data.completedRevenue}
        upcomingRevenue={data.upcomingRevenue}
        gapToTarget={data.gapToTarget}
        lostRevenue={data.lostRevenue}
        monthlyTarget={data.monthlyTarget}
        targetReliable={data.targetReliable}
      />

      {/* Action recommendations */}
      <RecommendationsSection recs={recommendations} />

      {/* Top services */}
      <TopServicesSection services={data.topServices} />
    </PremiumPageShell>
  );
}
