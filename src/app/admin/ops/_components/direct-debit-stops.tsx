"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { markDirectDebitStoppedAction } from "@/server/admin/direct-debit-actions";

export interface AwaitingStopRow {
  id: string;
  email: string;
  name: string | null;
  directDebitId: string;
  priceMinor: number;
  /** מתי הגישה נסגרה — משם נמדד כמה זמן היא ממשיכה להיות מחויבת. */
  since: string | null;
}

/**
 * הוראות קבע שממתינות לעצירה ידנית ב-Grow.
 *
 * ביטול מנוי סוגר את הגישה, אבל את החיוב עצמו אי אפשר לעצור דרך Make — Grow
 * מציינת שזה חייב להיעשות באתר שלה. עד היום ההתראה על כך הייתה מייל בודד, ומייל
 * שפוספס פירושו לקוחה שביטלה וממשיכה לשלם. כאן זו משימה פתוחה שלא נעלמת עד
 * שמישהו עוצר את החיוב ומסמן.
 */
export function DirectDebitStops({ rows }: { rows: AwaitingStopRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">
        הוראות קבע שממתינות לעצירה ב-Grow
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        לכל אחת מהן הגישה כבר נסגרה — אבל החיוב החודשי ב-Grow ממשיך לרוץ. יש לעצור אותו בלוח
        הבקרה של Grow ואז לסמן כאן. כל יום שעובר הוא חיוב נוסף של מי שכבר ביטלה.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <StopRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function StopRow({ row }: { row: AwaitingStopRow }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return null;

  return (
    <div className="aura-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--error-light)", color: "var(--error)" }}
        >
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{row.name ?? row.email}</p>
          <p className="truncate text-xs text-muted">
            {row.name ? `${row.email} · ` : ""}
            ₪{(row.priceMinor / 100).toLocaleString("he-IL")} לחודש
            {row.since ? ` · בוטל ב-${row.since}` : ""}
          </p>
          {/* המזהה הוא מה שמחפשים בלוח הבקרה של Grow — לכן הוא מוצג במלואו. */}
          <p className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
            {row.directDebitId}
          </p>
          {error && (
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--error)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await markDirectDebitStoppedAction(row.id);
            if (res.ok) setDone(true);
            else setError(res.error ?? "אירעה תקלה.");
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {pending ? "מסמן…" : "סומן כנעצר ב-Grow"}
      </button>
    </div>
  );
}
