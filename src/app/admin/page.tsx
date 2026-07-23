import Link from "next/link";
import {
  Building2,
  Clock,
  CheckCircle2,
  Tag,
  XCircle,
  CalendarDays,
  Users2,
  ArrowLeft,
  Gem,
  Crown,
  AlertTriangle,
} from "lucide-react";
import {
  getAdminOverviewStats,
  getAccountSubscriptionRevenue,
} from "@/server/admin/queries";
import {
  getPlatformAnalytics,
  getRecentPlatformActivity,
} from "@/server/admin/platform-analytics";
import { Card } from "@/components/ui/card";
import { PlatformAnalyticsSection } from "./_components/platform-analytics-section";
import { PlatformActivityFeed } from "./_components/platform-activity-feed";

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: bg }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="display-num text-2xl font-bold tabular-nums text-foreground">
          {value.toLocaleString("he-IL")}
        </p>
        <p className="mt-0.5 text-xs font-medium text-muted">{label}</p>
      </div>
    </Card>
  );
}

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

export default async function AdminPage() {
  const [stats, revenue, platform, activity] = await Promise.all([
    getAdminOverviewStats(),
    getAccountSubscriptionRevenue(),
    getPlatformAnalytics(),
    getRecentPlatformActivity(25),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-primary">ניהול מערכת</p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
          סקירה כללית
        </h1>
        <p className="mt-1 text-sm text-muted">נתוני פלטפורמת Allura בזמן אמת</p>
        <div className="editorial-rule mt-4" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="סך הכל עסקים"
          value={stats.totalBusinesses}
          icon={<Building2 className="h-5 w-5" />}
          color="var(--primary)"
          bg="var(--primary-light)"
        />
        <StatCard
          label="בתקופת ניסיון"
          value={stats.trialCount}
          icon={<Clock className="h-5 w-5" />}
          color="var(--mauve)"
          bg="var(--mauve-light)"
        />
        <StatCard
          label="פעילים"
          value={stats.activeCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="var(--success)"
          bg="var(--success-light)"
        />
        <StatCard
          label="בהנחה"
          value={stats.discountedCount}
          icon={<Tag className="h-5 w-5" />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label="מושהים / בוטלו"
          value={stats.suspendedOrCancelledCount}
          icon={<XCircle className="h-5 w-5" />}
          color="var(--error)"
          bg="var(--error-light)"
        />
        <StatCard
          label="תורים החודש"
          value={stats.bookingsThisMonth}
          icon={<CalendarDays className="h-5 w-5" />}
          color="var(--info)"
          bg="var(--info-light)"
        />
        <StatCard
          label="לקוחות במערכת"
          value={stats.totalClients}
          icon={<Users2 className="h-5 w-5" />}
          color="var(--primary)"
          bg="var(--primary-light)"
        />
      </div>

      {/* Cross-tenant platform analytics — GMV, leaderboards, engagement */}
      <PlatformAnalyticsSection data={platform} />

      {/* Subscription revenue (owner→Allura billing) */}
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            הכנסות ממנויים
          </h2>
          <span className="text-xs text-muted">הכנסה חוזרת מהמנויים הפעילים</span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* MRR — the headline number */}
          <Card className="p-5" style={{ gridColumn: "span 2" }}>
            <p className="text-xs font-medium text-muted">הכנסה חודשית חוזרת (MRR)</p>
            <p className="display-num mt-1 text-3xl font-bold tabular-nums text-foreground">
              {formatILS(revenue.mrr)}
              <span className="mr-1 text-sm font-medium text-muted"> / חודש</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              קצב שנתי משוער: {formatILS(revenue.arr)}
            </p>
          </Card>

          <StatCard
            label="מנויים פעילים"
            value={revenue.activeCount}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="var(--success)"
            bg="var(--success-light)"
          />
          <StatCard
            label="בעיה בתשלום"
            value={revenue.pastDueCount}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="var(--error)"
            bg="var(--error-light)"
          />
          <StatCard
            label="פרימיום"
            value={revenue.premiumCount}
            icon={<Gem className="h-5 w-5" />}
            color="var(--primary)"
            bg="var(--primary-light)"
          />
          <StatCard
            label="פלטינום"
            value={revenue.platinumCount}
            icon={<Crown className="h-5 w-5" />}
            color="var(--accent)"
            bg="var(--accent-light)"
          />
          <StatCard
            label="ביטולים (פעילים עד סוף התקופה)"
            value={revenue.cancelledCount}
            icon={<XCircle className="h-5 w-5" />}
            color="var(--mauve)"
            bg="var(--mauve-light)"
          />
        </div>

        <p className="mt-2 text-xs text-muted">
          המספרים משקפים הכנסה חוזרת מהמנויים הפעילים כרגע — לא סך הגבייה ההיסטורי.
        </p>
      </div>

      {/* Live platform-wide activity feed */}
      <PlatformActivityFeed rows={activity} />

      {/* Quick link */}
      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-foreground">ניהול עסקים</p>
          <p className="mt-0.5 text-sm text-muted">
            חיפוש, סינון, עדכון תכניות וסטטוסים
          </p>
        </div>
        <Link
          href="/admin/businesses"
          className="bg-brand-gradient flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          לרשימת העסקים
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
