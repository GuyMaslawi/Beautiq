import Link from "next/link";
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
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1a2e" }}>
            ניהול לקוחות
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#888" }}>
            כל הלקוחות במערכת
            {q ? " — תוצאות לפי סינון" : ` — ${clients.length} לקוחות`}
          </p>
        </div>
        {q && (
          <Link
            href="/admin/clients"
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={{ background: "#f3f4f6", color: "#555" }}
          >
            ניקוי סינון ✕
          </Link>
        )}
      </div>

      {/* Search */}
      <AdminClientsSearch defaultQ={q} />

      {/* Table */}
      {clients.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-16 text-center"
          style={{ background: "#fff", borderColor: "rgba(0,0,0,0.07)" }}
        >
          <p className="font-semibold" style={{ color: "#1a1a2e" }}>
            לא נמצאו לקוחות מתאימים.
          </p>
          <p className="mt-1 text-sm" style={{ color: "#888" }}>
            נסו לשנות את תנאי החיפוש
          </p>
        </div>
      ) : (
        <AdminClientsTable clients={clients} isTestMode={isTestMode} />
      )}
    </div>
  );
}
