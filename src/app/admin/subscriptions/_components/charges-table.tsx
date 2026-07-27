import Link from "next/link";
import { CheckCircle2, XCircle, RefreshCw, Sparkles } from "lucide-react";
import type { AdminChargeRow } from "@/server/admin/charge-queries";

function formatILS(amount: number): string {
  return `₪${amount.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));
}

/**
 * The billing ledger table. Read-only by design — these rows are the record of
 * what money moved, so nothing here edits them.
 *
 * Wide content scrolls inside its own container rather than stretching the page.
 */
export function ChargesTable({ rows }: { rows: AdminChargeRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border-border bg-surface rounded-2xl border p-10 text-center">
        <p className="text-foreground text-sm font-semibold">אין רכישות להצגה</p>
        <p className="text-muted mt-1 text-sm">
          כל תשלום — ראשון או חידוש חודשי — יופיע כאן אוטומטית ברגע ש-Grow מאשרת אותו.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-surface overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[52rem] text-right text-sm">
        <thead>
          <tr className="border-border text-muted border-b text-xs">
            <th className="px-4 py-3 font-medium">מתי</th>
            <th className="px-4 py-3 font-medium">בעלת העסק</th>
            <th className="px-4 py-3 font-medium">תוכנית</th>
            <th className="px-4 py-3 font-medium">סכום</th>
            <th className="px-4 py-3 font-medium">סוג</th>
            <th className="px-4 py-3 font-medium">תוצאה</th>
            <th className="px-4 py-3 font-medium">כרטיס</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border/60 border-b last:border-0">
              <td className="text-muted px-4 py-3 whitespace-nowrap tabular-nums">
                {formatDateTime(row.occurredAtISO)}
              </td>

              <td className="px-4 py-3">
                <div className="min-w-0">
                  {row.businessId ? (
                    <Link
                      href={`/admin/businesses/${row.businessId}`}
                      className="text-foreground hover:text-primary font-semibold"
                    >
                      {row.businessName ?? row.ownerName ?? row.ownerEmail}
                    </Link>
                  ) : (
                    <span className="text-foreground font-semibold">
                      {row.ownerName ?? row.ownerEmail}
                    </span>
                  )}
                  <p className="text-muted truncate text-xs">{row.ownerEmail}</p>
                </div>
              </td>

              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                  {row.plan === "platinum" ? (
                    <Sparkles className="text-accent h-3.5 w-3.5" />
                  ) : null}
                  {row.plan === "platinum" ? "פלטינום" : "פרימיום"}
                </span>
              </td>

              <td className="text-foreground px-4 py-3 font-semibold whitespace-nowrap tabular-nums">
                {formatILS(row.amount)}
              </td>

              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-muted inline-flex items-center gap-1.5 text-xs">
                  {row.isRecurring ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      חידוש חודשי
                    </>
                  ) : (
                    "רכישה ראשונה"
                  )}
                </span>
              </td>

              <td className="px-4 py-3">
                {row.outcome === "paid" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    שולם
                  </span>
                ) : (
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <XCircle className="h-3.5 w-3.5" />
                      נכשל
                    </span>
                    {row.failureReason && (
                      <p className="text-muted mt-0.5 max-w-[16rem] truncate text-xs" title={row.failureReason}>
                        {row.failureReason}
                      </p>
                    )}
                  </div>
                )}
              </td>

              <td className="text-muted px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                {row.cardSuffix ? `•••• ${row.cardSuffix}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
