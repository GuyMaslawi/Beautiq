"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  adminDeleteClientsAction,
  type AdminDeleteClientsResult,
} from "@/server/admin/client-actions";
import { AdminClientEditModal } from "./admin-client-edit-modal";
import { WhatsAppManualSendModal } from "@/components/clients/whatsapp-manual-send-modal";
import type { AdminClientListItem } from "@/server/admin/client-queries";

const CONFIRM_WORD = "מחיקה";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
}

interface Props {
  clients: AdminClientListItem[];
  isTestMode: boolean;
}

export function AdminClientsTable({ clients, isTestMode }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const allVisibleIds = useMemo(() => clients.map((c) => c.id), [clients]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allVisibleIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // Clients backing the currently-open confirmation modal.
  const confirmClients = useMemo(
    () => (confirmIds ? clients.filter((c) => confirmIds.includes(c.id)) : []),
    [confirmIds, clients],
  );

  function handleDeleted(result: AdminDeleteClientsResult) {
    if (result.success) {
      setConfirmIds(null);
      clearSelection();
      const count = result.deletedCount ?? 0;
      setSuccessMessage(
        count === 1 ? "הלקוחה נמחקה בהצלחה" : "הלקוחות נמחקו בהצלחה",
      );
    }
  }

  return (
    <>
      {successMessage && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "#ecfdf5", color: "#15803d", border: "1px solid #a7f3d0" }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "#15803d" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ background: "#1a1a2e", color: "#fff" }}
        >
          <span className="text-sm font-medium">{selected.size} לקוחות נבחרו</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              ניקוי בחירה
            </button>
            <button
              type="button"
              onClick={() => setConfirmIds([...selected])}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#dc2626", color: "#fff" }}
            >
              מחיקת לקוחות נבחרים
            </button>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="בחירת כל הלקוחות"
                    className="h-4 w-4 cursor-pointer rounded"
                    style={{ accentColor: "#1a1a2e" }}
                  />
                </th>
                {["שם לקוחה", "טלפון", "אימייל", "עסק", "WhatsApp", "שיווק", "ביקור אחרון", "הצטרפה", "", "", ""].map(
                  (col, i) => (
                    <th
                      key={`${col}-${i}`}
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
              {clients.map((client) => {
                const isChecked = selected.has(client.id);
                return (
                  <tr
                    key={client.id}
                    className="transition-colors hover:bg-gray-50"
                    style={{
                      borderBottom: "1px solid rgba(0,0,0,0.05)",
                      background: isChecked ? "rgba(220,38,38,0.04)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(client.id)}
                        aria-label={`בחירת ${client.fullName}`}
                        className="h-4 w-4 cursor-pointer rounded"
                        style={{ accentColor: "#1a1a2e" }}
                      />
                    </td>
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
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setConfirmIds([client.id])}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 whitespace-nowrap"
                        style={{ background: "rgba(220,38,38,0.08)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.25)" }}
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
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
          מציג {clients.length} לקוחות
        </div>
      </div>

      {confirmIds && (
        <DeleteClientsModal
          clients={confirmClients}
          onClose={() => setConfirmIds(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

function DeleteClientsModal({
  clients,
  onClose,
  onDeleted,
}: {
  clients: AdminClientListItem[];
  onClose: () => void;
  onDeleted: (result: AdminDeleteClientsResult) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const businessNames = [...new Set(clients.map((c) => c.businessName))];
  const multiBusiness = businessNames.length > 1;
  const namesPreview = clients.slice(0, 10);
  const remaining = clients.length - namesPreview.length;
  const canConfirm = confirmText.trim() === CONFIRM_WORD && clients.length > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await adminDeleteClientsAction(clients.map((c) => c.id));
      if (result.error) {
        setError(result.error);
        return;
      }
      onDeleted(result);
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div
          className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh]"
          style={{ background: "#fff" }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
          >
            <h2 className="text-base font-bold" style={{ color: "#b91c1c" }}>
              מחיקת לקוחות
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 transition-opacity hover:opacity-70"
              style={{ color: "#888" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
            <p className="text-sm leading-6" style={{ color: "#444" }}>
              הפעולה תמחק את הלקוחות שנבחרו ואת המידע המקושר אליהם. לא ניתן לשחזר פעולה זו.
            </p>

            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#7f1d1d" }}
            >
              <p className="font-semibold">
                נבחרו {clients.length} לקוחות למחיקה
              </p>
              {!multiBusiness && businessNames[0] && (
                <p className="mt-1 text-xs" style={{ color: "#9b2c2c" }}>
                  עסק: {businessNames[0]}
                </p>
              )}
            </div>

            {multiBusiness && (
              <div
                className="rounded-xl px-4 py-3 text-xs font-medium"
                style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
              >
                שימו לב: הלקוחות שנבחרו שייכים למספר עסקים ({businessNames.join(", ")}). המחיקה תתבצע בכל העסקים האלה.
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold" style={{ color: "#555" }}>
                הלקוחות שיימחקו:
              </p>
              <ul className="space-y-0.5 text-xs" style={{ color: "#666" }}>
                {namesPreview.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span style={{ color: "#1a1a2e" }}>{c.fullName}</span>
                    <span style={{ color: "#999" }}>{c.businessName}</span>
                  </li>
                ))}
                {remaining > 0 && (
                  <li style={{ color: "#999" }}>ועוד {remaining} לקוחות…</li>
                )}
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                להמשך, הקלידו את המילה «{CONFIRM_WORD}»
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                style={{ borderColor: "rgba(0,0,0,0.12)", background: "#f9f9fb", color: "#1a1a2e" }}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div
            className="flex shrink-0 items-center justify-end gap-3 px-5 py-4"
            style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "#555", background: "#f3f4f6", border: "1px solid rgba(0,0,0,0.1)" }}
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#dc2626" }}
            >
              {isPending ? "מוחק…" : "כן, למחוק"}
            </button>
          </div>
        </div>
      </div>
    </>
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
