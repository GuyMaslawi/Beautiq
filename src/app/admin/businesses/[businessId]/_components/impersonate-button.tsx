"use client";

import { useTransition } from "react";
import { UserCog } from "lucide-react";
import { startImpersonationAction } from "@/server/admin/impersonation-actions";

/**
 * "Login as owner" — launches impersonation for the given owner user. Guarded by
 * a confirm() since it drops the admin into the owner's live view of the app.
 */
export function ImpersonateButton({
  userId,
  ownerLabel,
}: {
  userId: string;
  ownerLabel: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm(
          `להתחבר כ${ownerLabel}? תראה את המערכת בדיוק כפי שהיא רואה אותה, ותוכל לחזור לניהול בכל רגע.`,
        );
        if (ok) start(() => startImpersonationAction(userId));
      }}
      className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
        background: "var(--accent-light)",
        color: "var(--accent)",
      }}
    >
      <UserCog className="h-3.5 w-3.5" />
      {pending ? "מתחבר…" : "התחבר כבעלת העסק"}
    </button>
  );
}
