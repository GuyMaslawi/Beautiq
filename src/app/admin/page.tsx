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
} from "lucide-react";
import { getAdminOverviewStats } from "@/server/admin/queries";
import { Card } from "@/components/ui/card";

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
    <Card className="flex items-center gap-4 p-5">
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

export default async function AdminPage() {
  const stats = await getAdminOverviewStats();

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
