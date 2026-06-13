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

export function BusinessDangerZone({ summary, ownerDeletable, ownerBlockReason }: Props) {
  // `mode` is null when closed, or the chosen deletion variant when the modal is open.
  const [mode, setMode] = useState<null | "business" | "user">(null);

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: "#fff", borderColor: "#fecaca", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
    >
      <h2 className="mb-1 text-sm font-bold" style={{ color: "#b91c1c" }}>
        אזור מסוכן — מחיקת עסק
      </h2>
      <p className="mb-4 text-xs leading-5" style={{ color: "#888" }}>
        מחיקת העסק תסיר לצמיתות את כל המידע שלו. פעולה זו מיועדת לניקוי נתוני בדיקה לפני העלייה לאוויר. לא ניתן לשחזר פעולה זו.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("business")}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#dc2626" }}
        >
          מחיקת עסק
        </button>

        <button
          type="button"
          onClick={() => setMode("user")}
          disabled={!ownerDeletable}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5" }}
        >
          מחיקת משתמש ועסק
        </button>
      </div>

      {!ownerDeletable && ownerBlockReason && (
        <p className="mt-3 text-xs" style={{ color: "#92400e" }}>
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
              מחיקת עסק וכל המידע שלו
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
              הפעולה תמחק את העסק, הלקוחות, התורים, ההודעות, האוטומציות, ההגדרות וכל המידע המקושר. לא ניתן לשחזר פעולה זו.
            </p>

            <div
              className="rounded-xl px-4 py-3 text-xs space-y-1.5"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#7f1d1d" }}
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
                style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
              >
                פעולה זו תמחק גם את חשבון המשתמש של הבעלים ({summary.ownerEmail ?? "—"}).
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                הקלידו את שם העסק לאישור
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={summary.name}
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
      <span style={{ color: "#9b2c2c" }}>{label}</span>
      <span className="font-semibold" style={{ color: "#7f1d1d" }}>
        {value}
      </span>
    </div>
  );
}
