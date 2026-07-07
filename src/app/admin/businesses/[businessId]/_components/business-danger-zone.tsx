"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { adminDeleteBusinessAction } from "@/server/admin/business-actions";

interface Summary {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  ownerEmail: string | null;
  clientCount: number;
  bookingCount: number;
  serviceCount: number;
  automationMessageCount: number;
}

interface Props {
  summary: Summary;
  /** True only when it is safe to also delete the owner User account. */
  ownerDeletable: boolean;
  /** Hebrew reason shown when the owner account cannot be deleted. */
  ownerBlockReason: string | null;
}

const ERROR_BORDER = "color-mix(in srgb, var(--error) 30%, transparent)";

export function BusinessDangerZone({ summary, ownerDeletable, ownerBlockReason }: Props) {
  // `mode` is null when closed, or the chosen deletion variant when the modal is open.
  const [mode, setMode] = useState<null | "business" | "user">(null);

  return (
    <div
      className="rounded-2xl border bg-surface p-6"
      style={{ borderColor: ERROR_BORDER, boxShadow: "var(--shadow-sm)" }}
    >
      <h2 className="mb-1 text-sm font-bold" style={{ color: "var(--error)" }}>
        אזור מסוכן — מחיקת עסק
      </h2>
      <p className="mb-4 text-xs leading-5 text-muted">
        מחיקת העסק תסיר לצמיתות את כל המידע שלו. פעולה זו מיועדת לניקוי נתוני בדיקה לפני העלייה לאוויר. לא ניתן לשחזר פעולה זו.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("business")}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #c85a5a 0%, var(--error) 100%)",
            boxShadow: "0 1px 4px rgba(190,74,74,0.20)",
          }}
        >
          מחיקת עסק
        </button>

        <button
          type="button"
          onClick={() => setMode("user")}
          disabled={!ownerDeletable}
          className="rounded-xl border bg-surface px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: "var(--error)", borderColor: ERROR_BORDER }}
        >
          מחיקת משתמש ועסק
        </button>
      </div>

      {!ownerDeletable && ownerBlockReason && (
        <p className="mt-3 text-xs" style={{ color: "var(--warning)" }}>
          {ownerBlockReason}
        </p>
      )}

      {mode && (
        <DeleteBusinessModal
          summary={summary}
          deleteOwnerUser={mode === "user"}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

function DeleteBusinessModal({
  summary,
  deleteOwnerUser,
  onClose,
}: {
  summary: Summary;
  deleteOwnerUser: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm =
    confirmText.trim() === summary.name || confirmText.trim() === summary.slug;

  function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await adminDeleteBusinessAction(
        summary.id,
        confirmText.trim(),
        deleteOwnerUser,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      // The business page no longer exists — go back to the list.
      router.push("/admin/businesses");
      router.refresh();
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
              מחיקת עסק וכל המידע שלו
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
              הפעולה תמחק את העסק, הלקוחות, התורים, ההודעות, האוטומציות, ההגדרות וכל המידע המקושר. לא ניתן לשחזר פעולה זו.
            </p>

            <div
              className="space-y-1.5 rounded-xl px-4 py-3 text-xs"
              style={{
                background: "var(--error-light)",
                border: `1px solid ${ERROR_BORDER}`,
                color: "var(--error)",
              }}
            >
              <SummaryRow label="שם העסק" value={summary.name} />
              <SummaryRow label="מזהה (slug)" value={summary.slug} />
              <SummaryRow label="אימייל הבעלים" value={summary.ownerEmail ?? "—"} />
              <SummaryRow label="לקוחות" value={String(summary.clientCount)} />
              <SummaryRow label="תורים" value={String(summary.bookingCount)} />
              <SummaryRow label="שירותים" value={String(summary.serviceCount)} />
              <SummaryRow label="הודעות אוטומציה" value={String(summary.automationMessageCount)} />
            </div>

            {deleteOwnerUser && (
              <div
                className="rounded-xl px-4 py-3 text-xs font-medium"
                style={{
                  background: "var(--warning-light)",
                  border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                  color: "var(--warning)",
                }}
              >
                פעולה זו תמחק גם את חשבון המשתמש של הבעלים ({summary.ownerEmail ?? "—"}).
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted">
                הקלידו את שם העסק לאישור
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={summary.name}
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
              {isPending ? "מוחק…" : deleteOwnerUser ? "מחיקת משתמש ועסק" : "מחיקת עסק"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--error)", opacity: 0.8 }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--error)" }}>
        {value}
      </span>
    </div>
  );
}
