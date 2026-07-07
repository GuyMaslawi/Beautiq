import Link from "next/link";
import { X } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getAdminClients } from "@/server/admin/client-queries";
import { AdminClientsSearch } from "./_components/admin-clients-search";
import { AdminClientsTable } from "./_components/admin-clients-table";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const isTestMode = process.env.WHATSAPP_TEST_MODE === "true";

  const clients = await getAdminClients({ q });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-primary">ניהול מערכת</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-foreground">
            ניהול לקוחות
          </h1>
          <p className="mt-1 text-sm text-muted">
            כל הלקוחות במערכת
            {q ? " — תוצאות לפי סינון" : ` — ${clients.length} לקוחות`}
          </p>
        </div>
        {q && (
          <Link
            href="/admin/clients"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
          >
            ניקוי סינון
            <X className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="editorial-rule" />

      {/* Search */}
      <AdminClientsSearch defaultQ={q} />

      {/* Table */}
      {clients.length === 0 ? (
        <div className="aura-card rounded-2xl px-6 py-16 text-center">
          <p className="font-semibold text-foreground">לא נמצאו לקוחות מתאימים.</p>
          <p className="mt-1 text-sm text-muted">נסו לשנות את תנאי החיפוש</p>
        </div>
      ) : (
        <AdminClientsTable clients={clients} isTestMode={isTestMode} />
      )}
    </div>
  );
}
