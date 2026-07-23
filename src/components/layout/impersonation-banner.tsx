"use client";

import { useTransition } from "react";
import { Eye, LogOut } from "lucide-react";
import { stopImpersonationAction } from "@/server/admin/impersonation-actions";

/**
 * Persistent bottom banner shown while an admin is impersonating an owner, with
 * a one-click return to the admin area. Fixed so it is always reachable.
 */
export function ImpersonationBanner({ ownerName }: { ownerName: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4">
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg"
        style={{ background: "var(--foreground)", color: "var(--surface)" }}
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span className="text-sm">
          מצב צפייה — מחובר כ<span className="font-bold">{ownerName}</span>
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => stopImpersonationAction())}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--surface)", color: "var(--foreground)" }}
        >
          <LogOut className="h-3.5 w-3.5" />
          {pending ? "חוזר…" : "חזרה לניהול"}
        </button>
      </div>
    </div>
  );
}
