import {
  TrendingUp,
  Wallet,
  CalendarCheck,
  Users2,
  Target,
  Activity,
  Sparkles,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type {
  AdminBusinessProfile,
  UsageLevel,
  FeatureUsage,
} from "@/server/admin/business-profile";
import type {
  BookingStatus,
  ActivityCategory,
  ActivityActorType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function shekel(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

function dateHe(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dateTimeHe(d: Date): string {
  return new Date(d).toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "ממתין",
  approved: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיעה",
  rescheduled: "נדחה",
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: "var(--warning)",
  approved: "var(--mauve)",
  completed: "var(--success)",
  cancelled: "var(--error)",
  no_show: "var(--error)",
  rescheduled: "var(--muted)",
};

const CONFIDENCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "ביטחון גבוה",
  medium: "ביטחון בינוני",
  low: "ביטחון נמוך",
};

const CATEGORY_META: Record<ActivityCategory, { label: string; color: string }> = {
  auth: { label: "התחברות", color: "var(--mauve)" },
  booking: { label: "תורים", color: "var(--success)" },
  client: { label: "לקוחות", color: "var(--primary)" },
  service: { label: "שירותים", color: "var(--accent)" },
  availability: { label: "זמינות", color: "var(--info)" },
  settings: { label: "הגדרות", color: "var(--muted)" },
  finance: { label: "פיננסים", color: "var(--warning)" },
  automation: { label: "אוטומציה", color: "var(--info)" },
  campaign: { label: "קמפיינים", color: "var(--accent)" },
  loyalty: { label: "נאמנות", color: "var(--primary)" },
  subscription: { label: "מנוי", color: "var(--success)" },
  admin: { label: "אדמין", color: "var(--error)" },
  other: { label: "אחר", color: "var(--muted)" },
};

const ACTOR_LABELS: Record<ActivityActorType, string> = {
  owner: "בעלת העסק",
  admin: "מנהל",
  system: "מערכת",
  client: "לקוחה",
};

// ---------------------------------------------------------------------------
// Usage-level visuals
// ---------------------------------------------------------------------------

const LEVEL_META: Record<
  UsageLevel,
  { label: string; color: string; bars: number }
> = {
  none: { label: "לא בשימוש", color: "var(--muted-light)", bars: 0 },
  low: { label: "מעט", color: "var(--warning)", bars: 1 },
  medium: { label: "בינוני", color: "var(--mauve)", bars: 2 },
  high: { label: "הרבה", color: "var(--success)", bars: 3 },
};

function UsageBars({ level }: { level: UsageLevel }) {
  const meta = LEVEL_META[level];
  return (
    <div className="flex items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm"
          style={{
            height: `${6 + i * 4}px`,
            background: i < meta.bars ? meta.color : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational blocks
// ---------------------------------------------------------------------------

function Metric({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        <span style={{ color: accent ?? "var(--primary)" }}>{icon}</span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p
        className="mt-2 text-xl font-bold tracking-tight"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function FeatureRow({ f }: { f: FeatureUsage }) {
  const meta = LEVEL_META[f.level];
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <UsageBars level={f.level} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{f.label}</p>
        {f.hint && <p className="text-xs text-muted">{f.hint}</p>}
      </div>
      <span className="shrink-0 text-xs font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </span>
      <span className="w-10 shrink-0 text-left text-xs tabular-nums text-muted">
        {f.count.toLocaleString("he-IL")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dossier
// ---------------------------------------------------------------------------

export function BusinessDossier({ profile }: { profile: AdminBusinessProfile }) {
  const { forecast: fc } = profile;

  return (
    <div className="space-y-6">
      {/* Headline strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          חברה מאז {dateHe(profile.memberSince)}
        </span>
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          פעילות אחרונה: {dateHe(profile.lastActivityAt)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          כניסה אחרונה של הבעלים: {dateHe(profile.ownerLastSeenAt)}
        </span>
      </div>

      {/* Revenue metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={<Wallet className="h-4 w-4" />}
          label="הכנסה החודש"
          value={shekel(fc.completedRevenue)}
          sub={`${fc.completedBookingsCount} תורים שהושלמו`}
          accent="var(--success)"
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4" />}
          label="רווח החודש"
          value={shekel(profile.monthProfit)}
          sub={`הוצאות ${shekel(profile.monthExpenses)}`}
        />
        <Metric
          icon={<CalendarCheck className="h-4 w-4" />}
          label="צפי החודש"
          value={shekel(fc.expectedRevenue)}
          sub={`+ ${shekel(fc.upcomingRevenue)} עתידי`}
        />
        <Metric
          icon={<Sparkles className="h-4 w-4" />}
          label="הכנסה מצטברת"
          value={shekel(profile.lifetimeRevenue)}
          sub={`${profile.lifetimeCompletedCount} תורים סה״כ`}
          accent="var(--accent)"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Forecast + target */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">יעד ותחזית חודשית</h2>
            <span
              className="mr-auto rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: "var(--background-alt)",
                color:
                  fc.confidence === "high"
                    ? "var(--success)"
                    : fc.confidence === "medium"
                      ? "var(--mauve)"
                      : "var(--muted)",
              }}
            >
              {CONFIDENCE_LABELS[fc.confidence]}
            </span>
          </div>

          {fc.hasEnoughData ? (
            <>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">
                  {shekel(fc.expectedRevenue)}
                </span>
                <span className="text-xs text-muted">
                  מתוך יעד {shekel(fc.monthlyTarget)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-background-alt">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, fc.actualProgressPct)}%`,
                    background: fc.isOnTrack
                      ? "var(--success)"
                      : "var(--brand-gradient-from, var(--primary))",
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted">פער ליעד</p>
                  <p className="text-sm font-bold text-foreground">
                    {fc.gapToTarget > 0 ? shekel(fc.gapToTarget) : "הושג ✓"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">חודש קודם</p>
                  <p className="text-sm font-bold text-foreground">
                    {shekel(fc.lastMonthRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">הכנסה אבודה</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: fc.lostRevenue > 0 ? "var(--error)" : "var(--foreground)" }}
                  >
                    {shekel(fc.lostRevenue)}
                  </p>
                </div>
              </div>
              {!fc.targetReliable && (
                <p className="mt-3 text-xs text-muted">
                  היעד מבוסס על מעט נתונים — עדיין לא אמין לחלוטין.
                </p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              אין עדיין מספיק נתונים לחישוב יעד ותחזית.
            </p>
          )}
        </Card>

        {/* Booking breakdown + growth */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              תורים ולקוחות ({profile.totalBookings.toLocaleString("he-IL")} סה״כ)
            </h2>
          </div>

          <div className="space-y-1.5">
            {(Object.keys(profile.bookingStatusCounts) as BookingStatus[])
              .filter((s) => profile.bookingStatusCounts[s] > 0)
              .sort((a, b) => profile.bookingStatusCounts[b] - profile.bookingStatusCounts[a])
              .map((s) => {
                const count = profile.bookingStatusCounts[s];
                const pct = profile.totalBookings
                  ? Math.round((count / profile.totalBookings) * 100)
                  : 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-medium text-foreground-soft">
                      {STATUS_LABELS[s]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background-alt">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: STATUS_COLOR[s] }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-left text-xs tabular-nums text-muted">
                      {count.toLocaleString("he-IL")} · {pct}%
                    </span>
                  </div>
                );
              })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-xs text-muted">
                <Users2 className="h-3 w-3" /> לקוחות
              </p>
              <p className="text-sm font-bold text-foreground">
                {profile.totalClients.toLocaleString("he-IL")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">לקוחות חדשים החודש</p>
              <p className="text-sm font-bold text-foreground">
                +{profile.newClientsThisMonth}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">לקוחות בסיכון</p>
              <p
                className="text-sm font-bold"
                style={{ color: fc.atRiskCount > 0 ? "var(--warning)" : "var(--foreground)" }}
              >
                {fc.atRiskCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Feature usage */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">שימוש בפיצ׳רים</h2>
          </div>
          <p className="mb-3 text-xs text-muted">
            במה העסק משתמש הרבה ובמה פחות — לפי הנתונים בפועל.
          </p>
          <div>
            {profile.features.map((f) => (
              <FeatureRow key={f.key} f={f} />
            ))}
          </div>
          {profile.heavyFeatures.length > 0 && (
            <p className="mt-3 text-xs text-foreground-soft">
              <span className="font-semibold">משתמש הרבה ב:</span>{" "}
              {profile.heavyFeatures.join(" · ")}
            </p>
          )}
          {profile.lightFeatures.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              <span className="font-semibold">פחות / בכלל לא:</span>{" "}
              {profile.lightFeatures.join(" · ")}
            </p>
          )}
        </Card>

        {/* Recent activity timeline */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">פעילות אחרונה</h2>
          </div>
          {profile.recentBookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">אין עדיין פעילות.</p>
          ) : (
            <ul className="space-y-2.5">
              {profile.recentBookings.map((b) => (
                <li key={b.id} className="flex items-center gap-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[b.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-medium">{b.clientName}</span>
                      <span className="text-muted"> · {b.serviceName}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {STATUS_LABELS[b.status]} · נקבע ל־{dateTimeHe(b.startTime)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {dateTimeHe(b.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {profile.lastAutomationRunAt && (
            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted">
              אוטומציה אחרונה: {dateTimeHe(profile.lastAutomationRunAt)}
            </p>
          )}
        </Card>
      </div>

      {/* Full activity log — real documented actions */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">יומן פעולות</h2>
        </div>
        <p className="mb-3 text-xs text-muted">
          כל פעולה מתועדת — התחברויות, תורים, עריכות ועוד. מתחיל להצטבר מרגע ההפעלה.
        </p>
        {profile.recentActivity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            עדיין לא תועדו פעולות עבור עסק זה.
          </p>
        ) : (
          <ul className="space-y-0">
            {profile.recentActivity.map((a) => {
              const meta = CATEGORY_META[a.category];
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-0"
                >
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--background-alt)", color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {a.summary}
                  </p>
                  <span className="shrink-0 text-xs text-muted">
                    {ACTOR_LABELS[a.actorType]}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {dateTimeHe(a.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
