import { MessageCircle, Check, Activity } from "lucide-react";
import type { RecentAutomationRun } from "@/server/automations/queries";

const RUN_TYPE_LABEL: Record<string, string> = {
  win_back: "החזרת לקוחות",
  morning_reminder: "תזכורת לתור",
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

/** The notifications Allura sends automatically — shown as a reassuring list. */
const ACTIVE_NOTIFICATIONS = [
  "אישור תור אחרי קביעה",
  "תזכורת לפני התור",
  "עדכון על ביטול או שינוי",
  "בקשת ביקורת אחרי הטיפול",
];

/**
 * Dashboard WhatsApp notifications section.
 *
 * Allura sends customer notifications automatically from its managed WhatsApp
 * sender — there is no setup or connection for the owner to do. This section is
 * purely reassuring: it confirms notifications are active and surfaces recent
 * sending activity. It is NOT a setup task and links to nothing.
 */
export function AutomationsSection({
  remindersDueCount,
  recentRuns,
}: {
  remindersDueCount: number;
  recentRuns: RecentAutomationRun[];
}) {
  const lastRun = recentRuns[0] ?? null;
  const activityValue = lastRun
    ? `${RUN_TYPE_LABEL[lastRun.type] ?? lastRun.type} · ${lastRun.sentCount} נשלחו`
    : "אין פעילות אחרונה";
  const activitySub = lastRun
    ? relativeDay(lastRun.startedAtISO)
    : "כאן תופיע פעילות השליחה ללקוחות";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Reassuring "active" card — spans two columns on desktop */}
      <div className="aura-card flex flex-col gap-3 rounded-[1.4rem] p-5 sm:col-span-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "rgba(61,139,110,0.12)", color: "#3d8b6e" }}
          >
            <MessageCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                התראות WhatsApp פעילות
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(61,139,110,0.12)", color: "#3d8b6e" }}
              >
                מנוהל על ידי Allura
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              שליחת ה-WhatsApp מנוהלת על ידי Allura — אין צורך לחבר חשבון או להגדיר דבר.
              אנחנו שולחים ללקוחות שלך אישורי תור, תזכורות ועדכונים באופן אוטומטי.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {ACTIVE_NOTIFICATIONS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#3d8b6e" }} />
              {item}
            </li>
          ))}
        </ul>

        {remindersDueCount > 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {remindersDueCount} תזכורות יישלחו ללקוחות הקרובות.
          </p>
        )}
      </div>

      {/* Recent activity — read-only */}
      <div className="aura-card flex flex-col gap-2.5 rounded-[1.4rem] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "var(--foreground-soft)" }}>
            פעילות אחרונה
          </span>
          <Activity className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--foreground)" }}>
          {activityValue}
        </p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {activitySub}
        </p>
      </div>
    </div>
  );
}
