import Link from "next/link";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { getAdminClients } from "@/server/admin/client-queries";
import { AdminClientsSearch } from "./_components/admin-clients-search";
import { AdminClientEditModal } from "./_components/admin-client-edit-modal";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";

function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
}

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
                  {["שם לקוחה", "טלפון", "אימייל", "עסק", "WhatsApp", "שיווק", "ביקור אחרון", "הצטרפה", "", ""].map(
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
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="transition-colors hover:bg-gray-50"
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: "#1a1a2e" }}>
                      {client.fullName}
                      {client.unsubscribedAt && (
                        <span
                          className="mr-2 rounded-full px-1.5 py-0.5 text-xs"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          הסירה עצמה
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr" style={{ color: "#444", textAlign: "left" }}>
                      {client.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr" style={{ color: "#666", textAlign: "left" }}>
                      {client.email ?? <span style={{ color: "#bbb" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/businesses/${client.businessId}`}
                        className="hover:underline text-xs font-medium"
                        style={{ color: "#0284c7" }}
                      >
                        {client.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OptInDot active={client.whatsappOptIn} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OptInDot active={client.marketingOptIn} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#666" }}>
                      {client.lastBookingAt ? formatDate(client.lastBookingAt) : <span style={{ color: "#bbb" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#888" }}>
                      {formatDate(client.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <WhatsAppManualSendModal
                        clientId={client.id}
                        clientName={client.fullName}
                        clientPhone={client.phone}
                        businessName={client.businessName}
                        isTestMode={isTestMode}
                        isAdmin
                        trigger={
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 whitespace-nowrap"
                            style={{ background: "rgba(22,163,74,0.10)", color: "#15803d", border: "1px solid rgba(22,163,74,0.25)" }}
                          >
                            שליחת WhatsApp
                          </button>
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <AdminClientEditModal
                        clientId={client.id}
                        initialData={{
                          fullName: client.fullName,
                          phone: client.phone,
                          email: client.email,
                          notes: client.notes,
                          whatsappOptIn: client.whatsappOptIn,
                          marketingOptIn: client.marketingOptIn,
                          businessName: client.businessName,
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
            style={{
              borderTop: "1px solid rgba(0,0,0,0.05)",
              background: "#fafafa",
              color: "#888",
            }}
          >
            מציג {clients.length} לקוחות
          </div>
        </div>
      )}
    </div>
  );
}

function OptInDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: active ? "#16a34a" : "#e5e7eb" }}
      title={active ? "כן" : "לא"}
    />
  );
}
