import Link from "next/link";
import { Wallet, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import {
  getAdminCharges,
  type ChargeOutcomeFilter,
  type ChargeKindFilter,
} from "@/server/admin/charge-queries";
import { ChargesFilters } from "./_components/charges-filters";
import { ChargesTable } from "./_components/charges-table";

const OUTCOMES: ChargeOutcomeFilter[] = ["all", "paid", "failed"];
const KINDS: ChargeKindFilter[] = ["all", "first", "recurring"];

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

/**
 * לוג הרכישות — כל חיוב של בעלת עסק מול Allura, מהראשון ועד כל חידוש חודשי.
 *
 * מסך הסקירה (/admin) מציג הכנסה חוזרת (MRR) — תמונת מצב של המנויים הפעילים
 * כרגע. כאן מוצג ההפך: מה נגבה בפועל לאורך זמן, כולל חיובים שנכשלו. שני
 * המספרים נחוצים ואינם מחליפים זה את זה.
 */
export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; kind?: string; q?: string; page?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;

  const outcome = OUTCOMES.includes(params.outcome as ChargeOutcomeFilter)
    ? (params.outcome as ChargeOutcomeFilter)
    : "all";
  const kind = KINDS.includes(params.kind as ChargeKindFilter)
    ? (params.kind as ChargeKindFilter)
    : "all";
  const q = params.q?.trim() ?? "";
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);

  const { rows, totals, hasMore } = await getAdminCharges({ outcome, kind, q, page });

  const buildPageHref = (nextPage: number) => {
    const sp = new URLSearchParams();
    if (outcome !== "all") sp.set("outcome", outcome);
    if (kind !== "all") sp.set("kind", kind);
    if (q) sp.set("q", q);
    if (nextPage > 0) sp.set("page", String(nextPage));
    const qs = sp.toString();
    return qs ? `/admin/subscriptions?${qs}` : "/admin/subscriptions";
  };

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <p className="eyebrow text-primary">ניהול מערכת</p>
        <h1 className="font-display text-foreground mt-1 text-2xl font-semibold tracking-tight">
          לוג רכישות
        </h1>
        <p className="text-muted mt-1 text-sm">
          כל חיוב של בעלת עסק מול Allura — רכישה ראשונה וכל חידוש חודשי, כולל חיובים שנכשלו.
        </p>
      </div>

      <div className="editorial-rule" />

      {/* Totals — always describe the CURRENT filter, never the whole table. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={<Wallet className="h-4 w-4" />}
          label="סך הגבייה"
          value={formatILS(totals.collected)}
          hint="מצטבר, לפי הסינון הנוכחי"
          emphasis
        />
        <SummaryTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="נגבה החודש"
          value={formatILS(totals.collectedThisMonth)}
          hint="מתחילת החודש הקלנדרי"
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="חיובים מוצלחים"
          value={String(totals.paidCount)}
        />
        <SummaryTile
          icon={<XCircle className="h-4 w-4" />}
          label="חיובים שנכשלו"
          value={String(totals.failedCount)}
          hint={totals.failedCount > 0 ? "שווה בדיקה" : undefined}
        />
      </div>

      <ChargesFilters outcome={outcome} kind={kind} q={q} />

      <ChargesTable rows={rows} />

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between gap-3">
          {page > 0 ? (
            <Link
              href={buildPageHref(page - 1)}
              className="border-border bg-surface text-muted hover:text-foreground rounded-xl border px-4 py-2 text-sm font-medium"
            >
              הקודם
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted text-xs">עמוד {page + 1}</span>
          {hasMore ? (
            <Link
              href={buildPageHref(page + 1)}
              className="border-border bg-surface text-muted hover:text-foreground rounded-xl border px-4 py-2 text-sm font-medium"
            >
              הבא
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <p className="text-muted text-xs">
        הרשומות נכתבות אוטומטית מאישור התשלום של Grow ואינן ניתנות לעריכה — זהו תיעוד של מה שקרה
        בפועל.
      </p>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="border-border bg-surface rounded-2xl border p-4">
      <div className="text-muted flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <p
        className={
          emphasis
            ? "font-display text-primary mt-1.5 text-2xl font-semibold tabular-nums"
            : "text-foreground mt-1.5 text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      {hint && <p className="text-muted mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}
