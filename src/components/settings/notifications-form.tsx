"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type { setEmailNotificationsAction } from "@/server/settings/actions";

export function NotificationsForm({
  action,
  initialEnabled,
}: {
  action: typeof setEmailNotificationsAction;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flipping the switch saves instantly — no separate save button.
  const handleToggle = (next: boolean) => {
    setEnabled(next);
    setError(null);
    setJustSaved(false);
    startTransition(async () => {
      const result = await action(next);
      if (result.error) {
        setEnabled(!next); // revert on failure
        setError(result.error);
      } else {
        setJustSaved(true);
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            {SETTINGS.notifications.toggleLabel}
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            {SETTINGS.notifications.hint}
          </p>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isPending}
          aria-label={SETTINGS.notifications.toggleLabel}
          className="mt-0.5"
        />
      </div>

      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="text-muted">
          {enabled ? SETTINGS.notifications.on : SETTINGS.notifications.off}
        </span>
        {isPending && (
          <span className="text-muted">· {SETTINGS.notifications.saving}</span>
        )}
        {justSaved && !isPending && (
          <span className="inline-flex items-center gap-1 text-green-600">
            <Check className="h-3.5 w-3.5" />
            {SETTINGS.notifications.saved}
          </span>
        )}
      </div>
    </div>
  );
}
