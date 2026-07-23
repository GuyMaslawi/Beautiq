import Link from "next/link";
import {
  Banknote,
  Trophy,
  CalendarRange,
  TrendingUp,
  Activity,
  MoonStar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PlatformAnalytics, LeaderRow } from "@/server/admin/platform-analytics";

function shekel(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

function dateHe(d: Date | null): string {
  if (!d) return "אף פעם";
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function Leaderboard({
  title,
  icon,
  rows,
  format,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  rows: LeaderRow[];
  format: (v: number) => string;
  accent: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">אין נתונים לחודש זה.</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.businessId} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-bold text-muted">{i + 1}</span>
              <Link
                href={`/admin/businesses/${r.businessId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {r.name}
              </Link>
              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-background-alt sm:block">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.value / max) * 100}%`, background: accent }}
                />
              </div>
              <span className="w-20 shrink-0 text-left text-xs font-semibold tabular-nums text-foreground-soft">
                {format(r.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function PlatformAnalyticsSection({ data }: { data: PlatformAnalytics }) {
  const gmvDelta = data.gmvThisMonth - data.gmvLastMonth;
  const gmvDeltaPct =
    data.gmvLastMonth > 0 ? Math.round((gmvDelta / data.gmvLastMonth) * 100) : null;
  const maxSignup = data.signupTrend.reduce((m, b) => Math.max(m, b.count), 0) || 1;
  const activePct = data.totalBusinesses
    ? Math.round((data.activeBusinessesThisMonth / data.totalBusinesses) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          פעילות הפלטפורמה
        </h2>
        <span className="text-xs text-muted">מבט-על על כל העסקים</span>
      </div>

      {/* Headline row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-5" style={{ gridColumn: "span 2" }}>
          <div className="flex items-center gap-2 text-muted">
            <Banknote className="h-4 w-4" style={{ color: "var(--success)" }} />
            <p className="text-xs font-medium">מחזור תורים החודש (כלל העסקים)</p>
          </div>
          <p className="display-num mt-1 text-3xl font-bold tabular-nums text-foreground">
            {shekel(data.gmvThisMonth)}
          </p>
          <p className="mt-1 text-xs text-muted">
            חודש קודם: {shekel(data.gmvLastMonth)}
            {gmvDeltaPct !== null && (
              <span
                className="mr-1 font-semibold"
                style={{ color: gmvDelta >= 0 ? "var(--success)" : "var(--error)" }}
              >
                {" "}
                ({gmvDelta >= 0 ? "+" : ""}
                {gmvDeltaPct}%)
              </span>
            )}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted">
            <Activity className="h-4 w-4" style={{ color: "var(--mauve)" }} />
            <p className="text-xs font-medium">עסקים פעילים החודש</p>
          </div>
          <p className="display-num mt-1 text-2xl font-bold tabular-nums text-foreground">
            {data.activeBusinessesThisMonth}
            <span className="mr-1 text-sm font-medium text-muted">
              {" "}
              / {data.totalBusinesses}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">{activePct}% מהעסקים קבעו תור החודש</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <p className="text-xs font-medium">עסקים חדשים החודש</p>
          </div>
          <p className="display-num mt-1 text-2xl font-bold tabular-nums text-foreground">
            +{data.newBusinessesThisMonth}
          </p>
          <p className="mt-1 text-xs text-muted">הצטרפו ב־30 הימים האחרונים</p>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Leaderboard
          title="מובילות בהכנסה החודש"
          icon={<Trophy className="h-4 w-4" />}
          rows={data.revenueLeaders}
          format={shekel}
          accent="var(--success)"
        />
        <Leaderboard
          title="מובילות בכמות תורים החודש"
          icon={<CalendarRange className="h-4 w-4" />}
          rows={data.bookingLeaders}
          format={(v) => `${v.toLocaleString("he-IL")} תורים`}
          accent="var(--mauve)"
        />
      </div>

      {/* Signup trend + dormant */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">הרשמות ב־6 חודשים</h3>
          </div>
          <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
            {data.signupTrend.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-foreground-soft">
                  {b.count}
                </span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(4, (b.count / maxSignup) * 90)}px`,
                    background: "var(--brand-gradient-from, var(--primary))",
                    opacity: 0.5 + (b.count / maxSignup) * 0.5,
                  }}
                />
                <span className="text-[10px] text-muted">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <MoonStar className="h-4 w-4" style={{ color: "var(--warning)" }} />
            <h3 className="text-sm font-bold text-foreground">עסקים רדומים</h3>
          </div>
          <p className="mb-3 text-xs text-muted">
            לא קבעו תור ב־30 הימים האחרונים — מועמדים לפנייה יזומה.
          </p>
          {data.dormant.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              כל העסקים פעילים 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {data.dormant.map((d) => (
                <li key={d.businessId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/businesses/${d.businessId}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {d.name}
                    </Link>
                    {d.ownerName && (
                      <p className="truncate text-xs text-muted">{d.ownerName}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    תור אחרון: {dateHe(d.lastBookingAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
