import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getAdminBusiness } from "@/server/admin/queries";
import { getAdminBusinessClients } from "@/server/admin/client-queries";
import { AdminClientEditModal } from "@/app/admin/clients/_components/admin-client-edit-modal";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
}

export default async function AdminBusinessClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { businessId } = await params;
  const { q: qRaw } = await searchParams;
  const q = qRaw?.trim() ?? "";

  const [biz, clients] = await Promise.all([
    getAdminBusiness(businessId),
    getAdminBusinessClients(businessId, q),
  ]);

  if (!biz) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/businesses/${businessId}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: "#f3f4f6", color: "#555" }}
        >
          ← חזרה לעסק
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#1a1a2e" }}>
          לקוחות העסק
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#888" }}>
          {biz.name} — {clients.length} לקוחות
          {q ? " (תוצאות חיפוש)" : ""}
        </p>
      </div>

      {/* Search */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם, טלפון או אימייל"
          className="w-full max-w-sm rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a1a2e]/15"
          style={{ borderColor: "rgba(0,0,0,0.12)", background: "#fff", color: "#1a1a2e" }}
        />
        <button
          type="submit"
          className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: "#1a1a2e" }}
        >
          חיפוש
        </button>
        {q && (
          <Link
            href={`/admin/businesses/${businessId}/clients`}
            className="rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            style={{ background: "#f3f4f6", color: "#555" }}
          >
            ניקוי ✕
          </Link>
        )}
      </form>

      {/* Table */}
      {clients.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-16 text-center"
          style={{ background: "#fff", borderColor: "rgba(0,0,0,0.07)" }}
        >
          <p className="font-semibold" style={{ color: "#1a1a2e" }}>
            {q ? "לא נמצאו לקוחות מתאימים." : "אין עדיין לקוחות לעסק זה."}
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
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", background: "#f9f9fb" }}>
                  {["שם", "טלפון", "אימייל", "תורים", "סה״כ הוצאה", "ביקור אחרון", "הצטרפה", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: "#888" }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: "#1a1a2e" }}>
                      {c.fullName}
                      {c.unsubscribedAt && (
                        <span className="mr-2 text-xs" style={{ color: "#dc2626" }}>
                          (הוסרה)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr" style={{ color: "#444", textAlign: "right" }}>
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr" style={{ color: "#444", textAlign: "right" }}>
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums" style={{ color: "#444" }}>
                      {c.totalBookings}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums" style={{ color: "#444" }}>
                      ₪{c.totalSpent.toLocaleString("he-IL")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#666" }}>
                      {fmtDate(c.lastBookingAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#888" }}>
                      {fmtDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminClientEditModal
                        clientId={c.id}
                        initialData={{
                          fullName: c.fullName,
                          phone: c.phone,
                          email: c.email,
                          notes: c.notes,
                          whatsappOptIn: c.whatsappOptIn,
                          marketingOptIn: c.marketingOptIn,
                          businessName: biz.name,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="px-4 py-3 text-xs"
            style={{ borderTop: "1px solid rgba(0,0,0,0.05)", background: "#fafafa", color: "#888" }}
          >
            מציג {clients.length} לקוחות
          </div>
        </div>
      )}
    </div>
  );
}
