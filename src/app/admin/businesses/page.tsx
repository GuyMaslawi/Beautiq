import Link from "next/link";
import { X } from "lucide-react";
import { getAdminBusinesses } from "@/server/admin/queries";
import { requirePlatformAdmin } from "@/server/admin/auth";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BusinessesSearch } from "./_components/businesses-search";
import { ClickableRow } from "./_components/clickable-row";
import { StopPropA, StopPropLink } from "./_components/stop-prop-link";
import type { SubscriptionStatus, SubscriptionPlan } from "@prisma/client";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "בתקופת ניסיון",
  active: "פעיל",
  discounted: "בהנחה",
  suspended: "מושהה",
  cancelled: "בוטל",
  pending_payment: "ממתין לתשלום",
};

const STATUS_STYLES: Record<SubscriptionStatus, { color: string; bg: string }> = {
  trial: { color: "var(--mauve)", bg: "var(--mauve-light)" },
  active: { color: "var(--success)", bg: "var(--success-light)" },
  discounted: { color: "var(--accent)", bg: "var(--accent-light)" },
  suspended: { color: "var(--warning)", bg: "var(--warning-light)" },
  cancelled: { color: "var(--error)", bg: "var(--error-light)" },
  pending_payment: { color: "var(--warning)", bg: "var(--warning-light)" },
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "בסיס",
  pro: "פרו",
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const plan = params.plan ?? "";

  const businesses = await getAdminBusinesses({ q, status, plan });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-primary">ניהול מערכת</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
            ניהול עסקים
          </h1>
          <p className="mt-1 text-sm text-muted">
            {businesses.length} עסקים
            {(q || status || plan) ? " — תוצאות לפי סינון" : ""}
          </p>
        </div>
        {(q || status || plan) && (
          <Link
            href="/admin/businesses"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
          >
            ניקוי סינון
            <X className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="editorial-rule" />

      {/* Search / filter */}
      <BusinessesSearch defaultQ={q} defaultStatus={status} defaultPlan={plan} />

      {/* Table */}
      {businesses.length === 0 ? (
        <div className="aura-card rounded-2xl px-6 py-16 text-center">
          <p className="font-semibold text-foreground">לא נמצאו עסקים מתאימים.</p>
          <p className="mt-1 text-sm text-muted">נסו לשנות את תנאי החיפוש</p>
        </div>
      ) : (
        <div className="aura-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "שם העסק",
                  "בעלים",
                  "אימייל",
                  "טלפון",
                  "תוכנית",
                  "סטטוס",
                  "ניסיון עד",
                  "הנחה",
                  "לקוחות",
                  "תורים",
                  "הצטרף",
                  "",
                ].map((col, i) => (
                  <TableHead key={`${col}-${i}`} className="px-4">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((biz) => {
                const owner = biz.members[0]?.user;
                const sub = biz.subscription;
                const status: SubscriptionStatus = sub?.status ?? "trial";
                const plan: SubscriptionPlan = sub?.plan ?? "basic";

                let discountLabel = "—";
                if (sub?.discountType === "fixed" && sub.discountValue) {
                  discountLabel = `₪${Number(sub.discountValue).toLocaleString("he-IL")}`;
                } else if (sub?.discountType === "percentage" && sub.discountValue) {
                  discountLabel = `${Number(sub.discountValue)}%`;
                }

                const trialLabel = sub?.trialEndsAt
                  ? new Date(sub.trialEndsAt).toLocaleDateString("he-IL", {
                      day: "numeric",
                      month: "numeric",
                      year: "2-digit",
                    })
                  : "—";

                const joinedLabel = biz.createdAt.toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "numeric",
                  year: "2-digit",
                });

                return (
                  <ClickableRow
                    key={biz.id}
                    href={`/admin/businesses/${biz.id}`}
                    className="border-b border-border transition-colors hover:bg-primary-light/50"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      <div>{biz.name}</div>
                      <div className="text-xs text-muted-light">/{biz.slug}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground-soft">
                      {owner?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {owner?.email ? (
                        <StopPropA
                          href={`mailto:${owner.email}`}
                          className="hover:underline"
                          style={{ color: "var(--info)" }}
                        >
                          {owner.email}
                        </StopPropA>
                      ) : (
                        <span className="text-muted-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {biz.phone ? (
                        <StopPropA
                          href={`tel:${biz.phone}`}
                          className="text-foreground-soft hover:underline"
                        >
                          {biz.phone}
                        </StopPropA>
                      ) : (
                        <span className="text-muted-light">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded bg-background-alt px-1.5 py-0.5 text-xs font-semibold text-foreground-soft">
                        {PLAN_LABELS[plan]}
                      </span>
                      <span className="mr-1 text-xs text-muted">
                        ₪{Number(sub?.monthlyPrice ?? 149).toLocaleString("he-IL")}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                      {trialLabel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                      {discountLabel}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground-soft">
                      {biz._count.clients}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground-soft">
                      {biz._count.bookings}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                      {joinedLabel}
                    </td>
                    <td className="px-4 py-3">
                      <StopPropLink
                        href={`/admin/businesses/${biz.id}`}
                        className="bg-brand-gradient rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      >
                        פרטים
                      </StopPropLink>
                    </td>
                  </ClickableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border bg-background-alt/50 px-4 py-3 text-xs text-muted">
            מציג {businesses.length} עסקים
          </div>
        </div>
      )}
    </div>
  );
}
