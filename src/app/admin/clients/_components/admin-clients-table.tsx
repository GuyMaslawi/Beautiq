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

const ERROR_BORDER = "color-mix(in srgb, var(--error) 30%, transparent)";

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
          style={{
            background: "var(--success-light)",
            color: "var(--success)",
            border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-full p-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--success)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-mid) 55%, var(--sidebar-bg-to) 100%)",
            color: "var(--sidebar-fg)",
          }}
        >
          <span className="text-sm font-medium">{selected.size} לקוחות נבחרו</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--sidebar-active-bg)", color: "var(--sidebar-fg)" }}
            >
              ניקוי בחירה
            </button>
            <button
              type="button"
              onClick={() => setConfirmIds([...selected])}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #c85a5a 0%, var(--error) 100%)" }}
            >
              מחיקת לקוחות נבחרים
            </button>
          </div>
        </div>
      )}

      <div className="aura-card overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="[&_tr]:border-b [&_tr]:border-border [&_tr]:bg-primary-light/40">
              <tr>
                <th className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="בחירת כל הלקוחות"
                    className="h-4 w-4 cursor-pointer rounded"
                    style={{ accentColor: "var(--primary)" }}
                  />
                </th>
                {["שם לקוחה", "טלפון", "אימייל", "עסק", "ביקור אחרון", "הצטרפה", "", "", ""].map(
                  (col, i) => (
                    <th
                      key={`${col}-${i}`}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-muted"
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
                    className="border-b border-border transition-colors hover:bg-primary-light/50"
                    style={{
                      background: isChecked ? "var(--error-light)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(client.id)}
                        aria-label={`בחירת ${client.fullName}`}
                        className="h-4 w-4 cursor-pointer rounded"
                        style={{ accentColor: "var(--primary)" }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      {client.fullName}
                      {client.unsubscribedAt && (
                        <span
                          className="mr-2 rounded-full px-1.5 py-0.5 text-xs"
                          style={{ background: "var(--warning-light)", color: "var(--warning)" }}
                        >
                          הסירה עצמה
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left text-foreground-soft" dir="ltr">
                      {client.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-left text-muted" dir="ltr">
                      {client.email ?? <span className="text-muted-light">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/businesses/${client.businessId}`}
                        className="text-xs font-medium hover:underline"
                        style={{ color: "var(--info)" }}
                      >
                        {client.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                      {client.lastBookingAt ? formatDate(client.lastBookingAt) : <span className="text-muted-light">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
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
                            className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                            style={{
                              background: "var(--success-light)",
                              color: "var(--success)",
                              border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                            }}
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
                          businessName: client.businessName,
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setConfirmIds([client.id])}
                        className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                        style={{
                          background: "var(--error-light)",
                          color: "var(--error)",
                          border: `1px solid ${ERROR_BORDER}`,
                        }}
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
        <div className="border-t border-border bg-background-alt/50 px-4 py-3 text-xs text-muted">
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
        <div className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface sm:max-w-md sm:rounded-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-bold" style={{ color: "var(--error)" }}>
              מחיקת לקוחות
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted transition-opacity hover:opacity-70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <p className="text-sm leading-6 text-foreground-soft">
              הפעולה תמחק את הלקוחות שנבחרו ואת המידע המקושר אליהם. לא ניתן לשחזר פעולה זו.
            </p>

            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "var(--error-light)",
                border: `1px solid ${ERROR_BORDER}`,
                color: "var(--error)",
              }}
            >
              <p className="font-semibold">
                נבחרו {clients.length} לקוחות למחיקה
              </p>
              {!multiBusiness && businessNames[0] && (
                <p className="mt-1 text-xs opacity-80">עסק: {businessNames[0]}</p>
              )}
            </div>

            {multiBusiness && (
              <div
                className="rounded-xl px-4 py-3 text-xs font-medium"
                style={{
                  background: "var(--warning-light)",
                  border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                  color: "var(--warning)",
                }}
              >
                שימו לב: הלקוחות שנבחרו שייכים למספר עסקים ({businessNames.join(", ")}). המחיקה תתבצע בכל העסקים האלה.
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted">הלקוחות שיימחקו:</p>
              <ul className="space-y-0.5 text-xs text-muted">
                {namesPreview.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span className="text-foreground">{c.fullName}</span>
                    <span className="text-muted-light">{c.businessName}</span>
                  </li>
                ))}
                {remaining > 0 && (
                  <li className="text-muted-light">ועוד {remaining} לקוחות…</li>
                )}
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted">
                להמשך, הקלידו את המילה «{CONFIRM_WORD}»
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                className="w-full rounded-xl border border-border bg-background-alt px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-light focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--error-light)", color: "var(--error)" }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-background-alt px-4 py-2 text-sm font-medium text-muted transition-opacity hover:opacity-80"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #c85a5a 0%, var(--error) 100%)",
                boxShadow: "0 1px 4px rgba(190,74,74,0.20)",
              }}
            >
              {isPending ? "מוחק…" : "כן, למחוק"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

