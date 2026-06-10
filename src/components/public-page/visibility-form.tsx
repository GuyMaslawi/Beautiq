"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  updateVisibilityAction,
  VisibilityFormState,
} from "@/server/public-page/actions";

const INITIAL: VisibilityFormState = {};

type VisibilityKeys =
  | "showServices"
  | "showPrices"
  | "showHours"
  | "showReviews"
  | "showGallery"
  | "showCancellationPolicy"
  | "showPhone"
  | "showAddress";

const TOGGLES: { key: VisibilityKeys; label: string }[] = [
  { key: "showServices", label: PUBLIC_PAGE.visibility.showServices },
  { key: "showPrices", label: PUBLIC_PAGE.visibility.showPrices },
  { key: "showHours", label: PUBLIC_PAGE.visibility.showHours },
  { key: "showPhone", label: PUBLIC_PAGE.visibility.showPhone },
  { key: "showAddress", label: PUBLIC_PAGE.visibility.showAddress },
  { key: "showCancellationPolicy", label: PUBLIC_PAGE.visibility.showCancellationPolicy },
  { key: "showGallery", label: PUBLIC_PAGE.visibility.showGallery },
  { key: "showReviews", label: PUBLIC_PAGE.visibility.showReviews },
];

export function VisibilityForm({
  action,
  initialValues,
}: {
  action: typeof updateVisibilityAction;
  initialValues: Record<VisibilityKeys, boolean>;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);
  const [values, setValues] = useState<Record<VisibilityKeys, boolean>>(initialValues);

  const toggle = (key: VisibilityKeys) =>
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <div className="space-y-3">
        {TOGGLES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <input type="hidden" name={key} value={values[key] ? "true" : "false"} />
            <span className="text-sm text-[var(--foreground)]">{label}</span>
            <Switch
              checked={values[key]}
              onCheckedChange={() => toggle(key)}
              aria-label={label}
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? PUBLIC_PAGE.visibility.saving
          : PUBLIC_PAGE.visibility.saveButton}
      </Button>
    </form>
  );
}
