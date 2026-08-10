import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { CALLBACK_RESULT_HE, type GrowCallbackRow } from "@/server/subscription/callback-log";

/**
 * חיוויי התשלום האחרונים מ-Grow, כפי שהתקבלו.
 *
 * זה המסך שעונה על "שילמתי — למה לא נפתחה הגישה?". עד שהתקבל חיוב אמיתי ראשון,
 * מבנה החיוויים של Grow הוא הנחה מהתיעוד ולא עובדה: שמות שדות, אם הסכום מגיע
 * בשקלים או באגורות, ובאיזה ערוץ מדווח חידוש חודשי. כשמשהו לא מסתדר, הגוף
 * הגולמי כאן הוא הדבר היחיד שאומר למה — הלוג לבדו שומר שלושה שדות נבחרים.
 */
export function GrowCallbacks({ rows }: { rows: GrowCallbackRow[] }) {
  const problems = rows.filter((r) => r.isProblem).length;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">חיוויי תשלום מ-Grow</h2>
      <p className="mt-0.5 text-sm text-muted">
        כל פנייה ל-webhook של המנויים נרשמת כאן — כולל כאלה שנדחו. הסודות שלנו מוסתרים.
      </p>

      {rows.length === 0 ? (
        <div className="aura-card mt-3 flex items-center gap-3 rounded-2xl px-4 py-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--background-alt)", color: "var(--muted)" }}
          >
            <Inbox className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold text-foreground">עדיין לא התקבל אף חיווי</p>
            <p className="text-sm text-muted">
              כלומר טרם בוצעה עסקה אמיתית. אחרי התשלום הראשון תופיע כאן שורה — ואם משהו
              ישתבש, הגוף המלא שהתקבל.
            </p>
          </div>
        </div>
      ) : (
        <>
          {problems > 0 && (
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--error)" }}>
              {problems} מהחיוויים האחרונים לא טופלו כמצופה — פתח אותם וקרא את הגוף הגולמי.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <details key={row.id} className="aura-card rounded-2xl px-4 py-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: row.isProblem ? "var(--error-light)" : "var(--success-light)",
                      color: row.isProblem ? "var(--error)" : "var(--success)",
                    }}
                  >
                    {row.isProblem ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">
                      {CALLBACK_RESULT_HE[row.result] ?? row.result}
                    </span>
                    <span className="block text-xs text-muted">
                      {row.createdAt.toLocaleString("he-IL", {
                        timeZone: "Asia/Jerusalem",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {row.isRecurringRun ? " · חיוב חוזר" : ""}
                      {row.sumMinor !== null ? ` · ₪${(row.sumMinor / 100).toFixed(2)}` : ""}
                      {row.directDebitId ? ` · הוראת קבע ${row.directDebitId}` : ""}
                    </span>
                  </span>
                </summary>
                {row.note && <p className="mt-2 text-sm text-muted">{row.note}</p>}
                <pre
                  dir="ltr"
                  className="mt-2 overflow-x-auto rounded-xl p-3 text-xs"
                  style={{ background: "var(--background-alt)" }}
                >
                  {row.raw || "(גוף ריק)"}
                </pre>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
