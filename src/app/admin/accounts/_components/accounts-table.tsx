"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Ban, Gem, ExternalLink, ShieldAlert } from "lucide-react";
import { adminSetAccountPlanByUserAction } from "@/server/admin/account-actions";
import { trialDaysLeft } from "@/lib/subscription/trial";

export interface AccountRow {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  planExpiresAt: string | null;
  suspendedUntil: string | null;
  customPriceMinor: number | null;
  subscriptionStatus: string | null;
  business: { id: string; name: string; slug: string } | null;
  hasAccess: boolean;
  onTrial: boolean;
}

/** משך מנוי הניסיון בימים — אותן ברירות מחדל כמו במסך העסק. */
const TRIAL_PRESETS = [14, 30, 60];

function dateHe(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** yyyy-mm-dd בעוד `days` ימים — הפורמט שהפעולה בשרת מצפה לו. */
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}



export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [trialDays, setTrialDays] = useState(30);
  // "עכשיו" נלכד פעם אחת — שעון בזמן render אינו דטרמיניסטי.
  const [nowMs] = useState(() => Date.now());

  function run(userId: string, fn: () => Promise<{ success: boolean; message?: string; error?: string }>, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setMsg(null);
    setBusyId(userId);
    start(async () => {
      const res = await fn();
      setBusyId(null);
      setMsg(
        res.success
          ? { ok: true, text: res.message ?? "הפעולה בוצעה." }
          : { ok: false, text: res.error ?? "הפעולה נכשלה." },
      );
      if (res.success) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* בחירת משך הניסיון — אחת לכל המסך, כדי שהענקה לכמה בעלות עסק תהיה מהירה */}
      <div className="aura-card flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
        <span className="text-sm font-medium text-foreground">משך מנוי הניסיון:</span>
        {TRIAL_PRESETS.map((d) => {
          const active = trialDays === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setTrialDays(d)}
              className="rounded-xl border px-2.5 py-1 text-sm font-medium transition-colors"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "var(--accent-light)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--foreground)",
              }}
            >
              {d} ימים
            </button>
          );
        })}
        <input
          type="number"
          min={1}
          max={365}
          value={trialDays}
          onChange={(e) => setTrialDays(Number(e.target.value))}
          className="w-20 rounded-xl border border-border bg-surface px-2.5 py-1 text-sm text-foreground"
        />
        <span className="text-xs text-muted">
          הגישה נפתחת מיד ונסגרת אוטומטית בתום התקופה — אין חיוב ואין צורך בכרטיס אשראי.
        </span>
      </div>

      {msg && (
        <p
          className="rounded-xl px-3.5 py-2.5 text-sm"
          style={{
            background: msg.ok ? "var(--success-light)" : "var(--error-light)",
            color: msg.ok ? "var(--success)" : "var(--error)",
          }}
        >
          {msg.text}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const busy = pending && busyId === row.id;
          const suspended =
            !!row.suspendedUntil && new Date(row.suspendedUntil).getTime() > nowMs;

          return (
            <div key={row.id} className="aura-card rounded-2xl px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {row.name ?? "ללא שם"}
                    </p>
                    {row.onTrial && row.planExpiresAt && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                      >
                        ניסיון — נותרו {trialDaysLeft(row.planExpiresAt, nowMs)} ימים
                      </span>
                    )}
                    {row.hasAccess && !row.onTrial && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--success-light)", color: "var(--success)" }}
                      >
                        גישה פעילה
                      </span>
                    )}
                    {!row.hasAccess && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--warning-light)", color: "var(--warning)" }}
                      >
                        ממתינה לגישה
                      </span>
                    )}
                    {suspended && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--error-light)", color: "var(--error)" }}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        מושהה
                      </span>
                    )}
                    {row.isAdmin && (
                      <span className="rounded-full bg-background-alt px-2 py-0.5 text-xs text-muted">
                        מנהל מערכת
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-sm text-muted" dir="ltr" style={{ textAlign: "right" }}>
                    {row.email}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    נרשמה ב־{dateHe(row.createdAt)}
                    {row.business ? (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/businesses/${row.business.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {row.business.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </>
                    ) : (
                      " · טרם הקימה עסק"
                    )}
                    {row.onTrial && row.planExpiresAt && ` · ניסיון עד ${dateHe(row.planExpiresAt)}`}
                    {row.customPriceMinor != null &&
                      ` · מחיר מוסכם ₪${Math.round(row.customPriceMinor / 100)}`}
                  </p>
                </div>

                {/* פעולות */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365}
                    onClick={() =>
                      run(
                        row.id,
                        () =>
                          adminSetAccountPlanByUserAction(
                            row.id,
                            "standard",
                            addDaysISO(trialDays),
                          ),
                        `להעניק ל${row.name ?? row.email} מנוי ניסיון חינם ל־${trialDays} ימים?`,
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ borderColor: "var(--accent)", background: "var(--accent)" }}
                  >
                    <Gift className="h-3.5 w-3.5" />
                    {row.onTrial ? "חידוש ניסיון" : "מנוי ניסיון"}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        row.id,
                        () => adminSetAccountPlanByUserAction(row.id, "standard", null),
                        `לפתוח ל${row.name ?? row.email} גישה מלאה ללא תאריך סיום? (בלי חיוב אוטומטי)`,
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-alt disabled:opacity-60"
                  >
                    <Gem className="h-3.5 w-3.5" />
                    גישה ללא הגבלה
                  </button>

                  {row.hasAccess && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          row.id,
                          () => adminSetAccountPlanByUserAction(row.id, "none", null),
                          `לסגור את הגישה של ${row.name ?? row.email}? היא תוחזר למסך התשלום.`,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-background-alt disabled:opacity-60"
                      style={{ borderColor: "var(--border)", color: "var(--error)" }}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      סגירת גישה
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
