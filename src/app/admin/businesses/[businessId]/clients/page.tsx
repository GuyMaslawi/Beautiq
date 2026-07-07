import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getAdminBusiness } from "@/server/admin/queries";
import { getAdminBusinessClients } from "@/server/admin/client-queries";
import { AdminClientEditModal } from "@/app/admin/clients/_components/admin-client-edit-modal";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          חזרה לעסק
        </Link>
      </div>

      <div>
        <p className="eyebrow text-primary">ניהול עסקים</p>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
          לקוחות העסק
        </h1>
        <p className="mt-1 text-sm text-muted">
          {biz.name} — {clients.length} לקוחות
          {q ? " (תוצאות חיפוש)" : ""}
        </p>
        <div className="editorial-rule mt-4" />
      </div>

      {/* Search */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם, טלפון או אימייל"
          className="w-full max-w-sm rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-light hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          className="bg-brand-gradient rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          חיפוש
        </button>
        {q && (
          <Link
            href={`/admin/businesses/${businessId}/clients`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
          >
            ניקוי
            <X className="h-3.5 w-3.5" />
          </Link>
        )}
      </form>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="aura-card rounded-2xl px-6 py-16 text-center">
          <p className="font-semibold text-foreground">
            {q ? "לא נמצאו לקוחות מתאימים." : "אין עדיין לקוחות לעסק זה."}
          </p>
        </div>
      ) : (
        <div className="aura-card overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                {["שם", "טלפון", "אימייל", "תורים", "סה״כ הוצאה", "ביקור אחרון", "הצטרפה", ""].map(
                  (col, i) => (
                    <TableHead key={`${col}-${i}`} className="px-4">
                      {col}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                    {c.fullName}
                    {c.unsubscribedAt && (
                      <span className="mr-2 text-xs" style={{ color: "var(--error)" }}>
                        (הוסרה)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-foreground-soft" dir="ltr">
                    {c.phone}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-foreground-soft" dir="ltr">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-foreground-soft">
                    {c.totalBookings}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-foreground-soft">
                    ₪{c.totalSpent.toLocaleString("he-IL")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                    {fmtDate(c.lastBookingAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border bg-background-alt/50 px-4 py-3 text-xs text-muted">
            מציג {clients.length} לקוחות
          </div>
        </div>
      )}
    </div>
  );
}
