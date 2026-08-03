import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getLaunchReadiness, type CheckLevel } from "@/server/ops/launch-readiness";

/**
 * מצב המערכת — התצוגה היחידה שאומרת אם ההשקה באמת מוכנה.
 *
 * כל מה שמופיע כאן נכשל בשקט: מצב בדיקה של WhatsApp שדולק ואף הודעה לא יוצאת,
 * ערוץ התראות שלא חובר, משימה מתוזמנת שהפסיקה לרוץ. שום מסך אחר במוצר לא היה
 * מגלה את זה, וגם לא בעלות העסק — הן פשוט לא היו מקבלות שירות.
 */
export const metadata = { title: "מצב המערכת · Allura" };

// המסך מדווח על סביבת הריצה בזמן אמת — אין מה לשמור במטמון.
export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<CheckLevel, { bg: string; fg: string; icon: React.ReactNode }> = {
  ok: {
    bg: "var(--success-light)",
    fg: "var(--success)",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warn: {
    bg: "var(--warning-light)",
    fg: "var(--warning)",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  blocker: {
    bg: "var(--error-light)",
    fg: "var(--error)",
    icon: <XCircle className="h-4 w-4" />,
  },
};

function relativeHe(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "ממש עכשיו";
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return `לפני ${days} ימים`;
}

export default async function AdminOpsPage() {
  await requirePlatformAdmin();
  const { checks, crons, blockers, warnings } = await getLaunchReadiness();

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <p className="eyebrow text-primary">ניהול מערכת</p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
          מצב המערכת
        </h1>
        <p className="mt-1 text-sm text-muted">
          תצורת הפרודקשן והמשימות המתוזמנות — כל מה שנכשל בשקט ולא מופיע בשום מסך אחר.
        </p>
      </div>

      <div className="editorial-rule" />

      {/* סיכום */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: blockers ? "var(--error-light)" : "var(--success-light)",
          border: `1px solid ${blockers ? "var(--error)" : "var(--success)"}`,
        }}
      >
        <p
          className="text-base font-bold"
          style={{ color: blockers ? "var(--error)" : "var(--success)" }}
        >
          {blockers
            ? `${blockers} דברים חוסמים השקה`
            : "אין חוסמים — המערכת מוכנה מבחינת תצורה"}
        </p>
        {warnings > 0 && (
          <p className="mt-0.5 text-sm text-muted">
            בנוסף {warnings} נושאים שכדאי לסגור, אך אינם חוסמים.
          </p>
        )}
      </div>

      {/* בדיקות תצורה */}
      <div className="space-y-3">
        {checks.map((c) => {
          const s = LEVEL_STYLE[c.level];
          return (
            <div key={c.key} className="aura-card flex items-start gap-3 rounded-2xl px-4 py-3.5">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: s.bg, color: s.fg }}
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{c.label}</p>
                <p className="mt-0.5 text-sm text-muted">{c.detail}</p>
                {c.action && (
                  <p className="mt-1 text-sm font-medium" style={{ color: s.fg }}>
                    {c.action}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* משימות מתוזמנות */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">משימות מתוזמנות</h2>
        <p className="mt-0.5 text-sm text-muted">
          כל משימה רושמת את עצמה בסיום. &quot;שקטה&quot; = לא רצה הרבה מעבר למרווח שלה —
          ואז תזכורות, קמפיינים ונאמנות פשוט לא קורים.
        </p>
        <div className="mt-3 space-y-2">
          {crons.map((c) => (
            <div
              key={c.key}
              className="aura-card flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: c.stale ? "var(--error-light)" : "var(--success-light)",
                    color: c.stale ? "var(--error)" : "var(--success)",
                  }}
                >
                  {c.stale ? <XCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                </span>
                <div>
                  <p className="font-semibold text-foreground">{c.label}</p>
                  <p className="text-xs text-muted">
                    {c.everyMinutes >= 1440
                      ? "פעם ביום"
                      : c.everyMinutes >= 60
                        ? `כל ${c.everyMinutes / 60} שעות`
                        : `כל ${c.everyMinutes} דקות`}
                    {" · "}
                    {c.path}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted" />
                <span style={{ color: c.stale ? "var(--error)" : "var(--foreground)" }}>
                  {c.lastRunAt ? relativeHe(c.lastRunAt) : "לא רצה מעולם"}
                </span>
                {c.lastOutcome === "error" && (
                  <span className="text-xs font-medium" style={{ color: "var(--error)" }}>
                    (הריצה האחרונה נכשלה)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          שים לב: הרישום מתחיל מהפריסה הראשונה שכוללת אותו, ולכן מיד אחרי פריסה כל
          המשימות יוצגו כשקטות עד לריצה הראשונה שלהן.
        </p>
      </div>
    </div>
  );
}
