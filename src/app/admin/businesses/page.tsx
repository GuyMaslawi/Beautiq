import Link from "next/link";
import { getAdminBusinesses } from "@/server/admin/queries";
import { requirePlatformAdmin } from "@/server/admin/auth";
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

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  trial: "#7c3aed",
  active: "#16a34a",
  discounted: "#d97706",
  suspended: "#ea580c",
  cancelled: "#dc2626",
  pending_payment: "#ca8a04",
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "בסיס",
  pro: "פרו",
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `${color}15`, color }}
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
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1a2e" }}>
            ניהול עסקים
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#888" }}>
            {businesses.length} עסקים
            {(q || status || plan) ? " — תוצאות לפי סינון" : ""}
          </p>
        </div>
        {(q || status || plan) && (
          <Link
            href="/admin/businesses"
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ background: "#f3f4f6", color: "#555" }}
          >
            ניקוי סינון ✕
          </Link>
        )}
      </div>

      {/* Search / filter */}
      <BusinessesSearch defaultQ={q} defaultStatus={status} defaultPlan={plan} />

      {/* Table */}
      {businesses.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-16 text-center"
          style={{ background: "#fff", borderColor: "rgba(0,0,0,0.07)" }}
        >
          <p className="font-semibold" style={{ color: "#1a1a2e" }}>
            לא נמצאו עסקים מתאימים.
          </p>
          <p className="mt-1 text-sm" style={{ color: "#888" }}>
            נסו לשנות את תנאי החיפוש
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: "#fff",
            borderColor: "rgba(0,0,0,0.07)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid rgba(0,0,0,0.07)",
                    background: "#f9f9fb",
                  }}
                >
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
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: "#888" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
                      className="transition-colors hover:bg-gray-50"
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: "#1a1a2e" }}>
                        <div>{biz.name}</div>
                        <div className="text-xs" style={{ color: "#aaa" }}>
                          /{biz.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#444" }}>
                        {owner?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {owner?.email ? (
                          <StopPropA
                            href={`mailto:${owner.email}`}
                            className="hover:underline"
                            style={{ color: "#0284c7" }}
                          >
                            {owner.email}
                          </StopPropA>
                        ) : (
                          <span style={{ color: "#aaa" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {biz.phone ? (
                          <StopPropA
                            href={`tel:${biz.phone}`}
                            className="hover:underline"
                            style={{ color: "#444" }}
                          >
                            {biz.phone}
                          </StopPropA>
                        ) : (
                          <span style={{ color: "#aaa" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-semibold"
                          style={{ background: "#f3f4f6", color: "#444" }}
                        >
                          {PLAN_LABELS[plan]}
                        </span>
                        <span className="mr-1 text-xs" style={{ color: "#888" }}>
                          ₪{Number(sub?.monthlyPrice ?? 149).toLocaleString("he-IL")}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#666" }}>
                        {trialLabel}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#666" }}>
                        {discountLabel}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums" style={{ color: "#444" }}>
                        {biz._count.clients}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums" style={{ color: "#444" }}>
                        {biz._count.bookings}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#888" }}>
                        {joinedLabel}
                      </td>
                      <td className="px-4 py-3">
                        <StopPropLink
                          href={`/admin/businesses/${biz.id}`}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                          style={{ background: "#1a1a2e" }}
                        >
                          פרטים
                        </StopPropLink>
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="px-4 py-3 text-xs"
            style={{
              borderTop: "1px solid rgba(0,0,0,0.05)",
              background: "#fafafa",
              color: "#888",
            }}
          >
            מציג {businesses.length} עסקים
          </div>
        </div>
      )}
    </div>
  );
}
