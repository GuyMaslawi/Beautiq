import Link from "next/link";
import { X } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import {
  getAdminAccounts,
  ACCOUNT_FILTERS,
  type AccountFilter,
} from "@/server/admin/account-queries";
import { AccountsTable } from "./_components/accounts-table";
import { AccountsSearch } from "./_components/accounts-search";

/**
 * ניהול חשבונות — כל בעלת עסק שנרשמה, כולל מי שעדיין לא הקימה עסק.
 *
 * "ניהול עסקים" מציג עסקים, ולכן בעלת עסק שנרשמה ונעצרה במסך התשלום אינה
 * מופיעה שם כלל — היא לא יכולה להקים עסק לפני שיש לה גישה. זה בדיוק החשבון
 * שצריך לקבל מנוי ניסיון ביום ההשקה, ולכן המסך הזה מסודר לפי חשבון ולא לפי עסק.
 */
export const metadata = { title: "ניהול חשבונות · Allura" };

const FILTER_LABELS: Record<AccountFilter, string> = {
  waiting: "ממתינות לגישה",
  trial: "בתקופת ניסיון",
  paid: "משלמות",
  all: "כל החשבונות",
};

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const filter = (ACCOUNT_FILTERS.includes(params.filter as AccountFilter)
    ? params.filter
    : "waiting") as AccountFilter;

  const { rows, counts } = await getAdminAccounts({ q, filter });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-primary">ניהול מערכת</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
            ניהול חשבונות
          </h1>
          <p className="mt-1 text-sm text-muted">
            פתיחת גישה ומתן מנוי ניסיון לבעלות עסק — גם לפני שהקימו עסק במערכת.
          </p>
        </div>
        {q && (
          <Link
            href="/admin/accounts"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
          >
            ניקוי חיפוש
            <X className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="editorial-rule" />

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {ACCOUNT_FILTERS.map((f) => {
          const active = f === filter;
          const href = `/admin/accounts?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={f}
              href={href}
              className="rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderColor: active ? "var(--primary)" : "var(--border)",
                background: active ? "var(--primary)" : "var(--surface)",
                color: active ? "#fff" : "var(--foreground)",
              }}
            >
              {FILTER_LABELS[f]}
              <span className="mr-1.5 text-xs opacity-70">{counts[f]}</span>
            </Link>
          );
        })}
      </div>

      <AccountsSearch defaultQ={q} filter={filter} />

      {rows.length === 0 ? (
        <div className="aura-card rounded-2xl px-6 py-16 text-center">
          <p className="font-semibold text-foreground">אין חשבונות בקטגוריה הזו.</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "אפשר לנקות את החיפוש או לבחור סינון אחר." : "כשבעלת עסק חדשה תירשם, היא תופיע כאן."}
          </p>
        </div>
      ) : (
        <AccountsTable
          rows={rows.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            planExpiresAt: r.planExpiresAt?.toISOString() ?? null,
            suspendedUntil: r.suspendedUntil?.toISOString() ?? null,
          }))}
        />
      )}
    </div>
  );
}
