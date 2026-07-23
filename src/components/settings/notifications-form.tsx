"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type {
  NotificationPrefsFormState,
  updateNotificationPrefsAction,
} from "@/server/settings/actions";

const INITIAL: NotificationPrefsFormState = {};

export function NotificationsForm({
  action,
  initialEnabled,
}: {
  action: typeof updateNotificationPrefsAction;
  initialEnabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      {/* Hidden input carries the value; a checkbox is only submitted when checked. */}
      {enabled && (
        <input type="hidden" name="emailNotificationsEnabled" value="1" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            {SETTINGS.notifications.toggleLabel}
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            {SETTINGS.notifications.hint}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className="relative mt-0.5 inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
          style={{ background: enabled ? "var(--primary)" : "var(--border)" }}
        >
          <span className="sr-only">{SETTINGS.notifications.toggleLabel}</span>
          <span
            className="absolute h-5 w-5 rounded-full bg-white shadow transition-all"
            style={{
              top: "0.125rem",
              insetInlineStart: enabled ? "calc(100% - 1.375rem)" : "0.125rem",
            }}
          />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending
            ? SETTINGS.notifications.saving
            : SETTINGS.notifications.saveButton}
        </Button>
        <span className="text-muted text-xs font-medium">
          {enabled ? SETTINGS.notifications.on : SETTINGS.notifications.off}
        </span>
      </div>
    </form>
  );
}
