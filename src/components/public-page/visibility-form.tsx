"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  setVisibilityFieldAction,
  VisibilityField,
} from "@/server/public-page/actions";

const TOGGLES: { key: VisibilityField; label: string }[] = [
  { key: "showServices", label: PUBLIC_PAGE.visibility.showServices },
  { key: "showPrices", label: PUBLIC_PAGE.visibility.showPrices },
  { key: "showHours", label: PUBLIC_PAGE.visibility.showHours },
  { key: "showPhone", label: PUBLIC_PAGE.visibility.showPhone },
  { key: "showAddress", label: PUBLIC_PAGE.visibility.showAddress },
  { key: "showGallery", label: PUBLIC_PAGE.visibility.showGallery },
  { key: "showReviews", label: PUBLIC_PAGE.visibility.showReviews },
];

export function VisibilityForm({
  action,
  initialValues,
}: {
  action: typeof setVisibilityFieldAction;
  initialValues: Record<VisibilityField, boolean>;
}) {
  const [values, setValues] = useState<Record<VisibilityField, boolean>>(initialValues);
  const [pendingKey, setPendingKey] = useState<VisibilityField | null>(null);
  const [savedKey, setSavedKey] = useState<VisibilityField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Flipping a switch saves that setting instantly — no separate save button.
  const handleToggle = (key: VisibilityField) => {
    const next = !values[key];
    setValues((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    setSavedKey(null);
    setError(null);
    startTransition(async () => {
      const result = await action(key, next);
      setPendingKey(null);
      if (result.error) {
        setValues((prev) => ({ ...prev, [key]: !next })); // revert on failure
        setError(result.error);
      } else {
        setSavedKey(key);
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <div className="space-y-3">
        {TOGGLES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              {label}
              {savedKey === key && pendingKey !== key && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                  <Check className="h-3.5 w-3.5" />
                  {PUBLIC_PAGE.visibility.saved}
                </span>
              )}
            </span>
            <Switch
              checked={values[key]}
              onCheckedChange={() => handleToggle(key)}
              disabled={pendingKey === key}
              aria-label={label}
            />
          </div>
        ))}
      </div>

      <p className="text-muted text-xs">{PUBLIC_PAGE.visibility.hint}</p>
    </div>
  );
}
