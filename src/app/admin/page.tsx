import Link from "next/link";
import { Building2, Clock, CheckCircle2, Tag, XCircle, CalendarDays, Users2 } from "lucide-react";
import { getAdminOverviewStats } from "@/server/admin/queries";

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border p-5"
      style={{
        background: "#fff",
        borderColor: "rgba(0,0,0,0.07)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}15` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "#1a1a2e" }}>
          {value.toLocaleString("he-IL")}
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: "#888" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1a1a2e" }}>
          סקירה כללית
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#888" }}>
          נתוני פלטפורמת Allura בזמן אמת
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="סך הכל עסקים"
          value={stats.totalBusinesses}
          icon={<Building2 className="h-5 w-5" />}
          color="#1a1a2e"
        />
        <StatCard
          label="בתקופת ניסיון"
          value={stats.trialCount}
          icon={<Clock className="h-5 w-5" />}
          color="#7c3aed"
        />
        <StatCard
          label="פעילים"
          value={stats.activeCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="#16a34a"
        />
        <StatCard
          label="בהנחה"
          value={stats.discountedCount}
          icon={<Tag className="h-5 w-5" />}
          color="#d97706"
        />
        <StatCard
          label="מושהים / בוטלו"
          value={stats.suspendedOrCancelledCount}
          icon={<XCircle className="h-5 w-5" />}
          color="#dc2626"
        />
        <StatCard
          label="תורים החודש"
          value={stats.bookingsThisMonth}
          icon={<CalendarDays className="h-5 w-5" />}
          color="#0284c7"
        />
        <StatCard
          label="לקוחות במערכת"
          value={stats.totalClients}
          icon={<Users2 className="h-5 w-5" />}
          color="#0891b2"
        />
      </div>

      {/* Quick link */}
      <div
        className="flex items-center justify-between rounded-2xl border p-5"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.07)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <div>
          <p className="font-semibold" style={{ color: "#1a1a2e" }}>
            ניהול עסקים
          </p>
          <p className="mt-0.5 text-sm" style={{ color: "#888" }}>
            חיפוש, סינון, עדכון תכניות וסטטוסים
          </p>
        </div>
        <Link
          href="/admin/businesses"
          className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "#1a1a2e" }}
        >
          לרשימת העסקים ←
        </Link>
      </div>
    </div>
  );
}
