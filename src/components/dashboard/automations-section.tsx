import Link from "next/link";
import { MessageCircle, Zap, Activity, ArrowLeft } from "lucide-react";
import type { RecentAutomationRun } from "@/server/automations/queries";

const RUN_TYPE_LABEL: Record<string, string> = {
  win_back: "החזרת לקוחות",
  morning_reminder: "תזכורת בוקר",
  review_request: "בקשת ביקורת",
  manual: "שליחה ידנית",
  booking_confirmation: "אישור תור",
};

const TZ = "Asia/Jerusalem";

function relativeDay(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const dayThen = then.toLocaleDateString("en-CA", { timeZone: TZ });
  const dayNow = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const diff = Math.round(
    (new Date(dayNow).getTime() - new Date(dayThen).getTime()) / 86400000,
  );
  if (diff <= 0) return "היום";
  if (diff === 1) return "אתמול";
  return `לפני ${diff} ימים`;
}

function StatusCard({
  href,
  icon: Icon,
  title,
  value,
  sub,
  dotColor,
}: {
  href: string;
  icon: typeof Zap;
  title: string;
  value: string;
  sub?: string;
  dotColor?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2.5 rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.98]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
          {title}
        </span>
        <Icon className="h-4 w-4" style={{ color: "#b86b8c" }} />
      </div>
      <div className="flex items-center gap-2">
        {dotColor && (
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} />
        )}
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--foreground)" }}>
          {value}
        </p>
      </div>
      {sub && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}
      <span
        className="mt-auto flex items-center gap-1 pt-1 text-xs font-semibold"
        style={{ color: "#b86b8c" }}
      >
        מעבר לאוטומציות
        <ArrowLeft className="h-3 w-3" />
      </span>
    </Link>
  );
}

/**
 * Dashboard Automations section — surfaces the existing WhatsApp connection
 * status, automation activity and recent run history for discoverability.
 * Read-only: every card links into /automations.
 */
export function AutomationsSection({
  whatsappLabel,
  whatsappReady,
  whatsappConnected,
  remindersDueCount,
  recentRuns,
}: {
  whatsappLabel: string;
  whatsappReady: boolean;
  whatsappConnected: boolean;
  remindersDueCount: number;
  recentRuns: RecentAutomationRun[];
}) {
  const waDot = whatsappReady ? "#3d8b6e" : whatsappConnected ? "#b8960a" : "#bbb3c2";

  const lastRun = recentRuns[0] ?? null;
  const activityValue = lastRun
    ? `${RUN_TYPE_LABEL[lastRun.type] ?? lastRun.type} · ${lastRun.sentCount} נשלחו`
    : "אין פעילות אחרונה";
  const activitySub = lastRun ? relativeDay(lastRun.startedAtISO) : "כאן תופיע פעילות השליחה";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatusCard
        href="/automations"
        icon={MessageCircle}
        title="חיבור WhatsApp"
        value={whatsappLabel}
        dotColor={waDot}
      />
      <StatusCard
        href="/automations"
        icon={Zap}
        title="אוטומציות"
        value={
          remindersDueCount > 0
            ? `${remindersDueCount} תזכורות מוכנות`
            : whatsappReady
              ? "פעילות ומוכנות"
              : "ממתינות להגדרה"
        }
        sub={remindersDueCount > 0 ? "ממתינות לשליחה ללקוחות" : undefined}
      />
      <StatusCard
        href="/automations"
        icon={Activity}
        title="פעילות אחרונה"
        value={activityValue}
        sub={activitySub}
      />
    </div>
  );
}
