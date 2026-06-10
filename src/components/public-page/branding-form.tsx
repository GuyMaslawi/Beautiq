"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  updateBrandingAction,
  BrandingFormState,
} from "@/server/public-page/actions";

const INITIAL: BrandingFormState = {};

export function BrandingForm({
  action,
  initialValues,
}: {
  action: typeof updateBrandingAction;
  initialValues: {
    logoUrl: string | null;
    coverImageUrl: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState({
    logoUrl: initialValues.logoUrl ?? "",
    coverImageUrl: initialValues.coverImageUrl ?? "",
  });

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <Field
        label={PUBLIC_PAGE.branding.logoLabel}
        htmlFor="logoUrl"
        hint={PUBLIC_PAGE.branding.logoHint}
      >
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          dir="ltr"
          placeholder={PUBLIC_PAGE.branding.logoPlaceholder}
          value={fields.logoUrl}
          onChange={(e) => set("logoUrl")(e.target.value)}
        />
      </Field>

      {fields.logoUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fields.logoUrl}
            alt="לוגו"
            className="h-16 w-16 rounded-xl object-cover border border-[var(--border)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-xs text-[var(--muted)]">תצוגה מקדימה של הלוגו</span>
        </div>
      )}

      <Field
        label={PUBLIC_PAGE.branding.coverLabel}
        htmlFor="coverImageUrl"
        hint={PUBLIC_PAGE.branding.coverHint}
      >
        <Input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          dir="ltr"
          placeholder={PUBLIC_PAGE.branding.coverPlaceholder}
          value={fields.coverImageUrl}
          onChange={(e) => set("coverImageUrl")(e.target.value)}
        />
      </Field>

      {fields.coverImageUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fields.coverImageUrl}
            alt="קאבר"
            className="h-28 w-full rounded-xl object-cover border border-[var(--border)]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">תצוגה מקדימה של תמונת הקאבר</p>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? PUBLIC_PAGE.branding.saving
          : PUBLIC_PAGE.branding.saveButton}
      </Button>
    </form>
  );
}
