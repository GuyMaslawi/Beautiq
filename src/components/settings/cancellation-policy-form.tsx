"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type { CancellationPolicyFormState } from "@/server/settings/actions";
import type { updateCancellationPolicyAction } from "@/server/settings/actions";
import type { CancellationPolicyData } from "@/server/settings/queries";

const INITIAL: CancellationPolicyFormState = {};

export function CancellationPolicyForm({
  action,
  initialValues,
}: {
  action: typeof updateCancellationPolicyAction;
  initialValues: CancellationPolicyData | null;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState({
    policyText: initialValues?.policyText ?? "",
    minNoticeHours: initialValues?.minNoticeHours?.toString() ?? "",
    requireDepositToBook: initialValues?.requireDepositToBook ?? false,
  });

  const set = (field: keyof typeof fields) => (value: string | boolean) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <p className="text-muted text-sm leading-relaxed">
        {SETTINGS.cancellationPolicy.hint}
      </p>

      <Field
        label={SETTINGS.cancellationPolicy.policyTextLabel}
        htmlFor="policyText"
      >
        <Textarea
          id="policyText"
          name="policyText"
          placeholder={SETTINGS.cancellationPolicy.policyTextPlaceholder}
          rows={3}
          value={fields.policyText}
          onChange={(e) => set("policyText")(e.target.value)}
        />
      </Field>

      <Field
        label={SETTINGS.cancellationPolicy.minNoticeHoursLabel}
        htmlFor="minNoticeHours"
        error={state.errors?.minNoticeHours}
      >
        <Input
          id="minNoticeHours"
          name="minNoticeHours"
          type="number"
          min="0"
          placeholder={SETTINGS.cancellationPolicy.minNoticeHoursPlaceholder}
          value={fields.minNoticeHours}
          onChange={(e) => set("minNoticeHours")(e.target.value)}
          className="w-40"
        />
      </Field>

      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="requireDepositToBook"
            value="true"
            checked={fields.requireDepositToBook}
            onChange={(e) => set("requireDepositToBook")(e.target.checked)}
            className="h-5 w-5 rounded accent-primary"
          />
          <span className="text-foreground font-medium">
            {SETTINGS.cancellationPolicy.requireDepositLabel}
          </span>
        </label>
        <p className="text-muted pr-8 text-xs leading-relaxed">
          {SETTINGS.cancellationPolicy.requireDepositHint}
        </p>
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending
          ? SETTINGS.cancellationPolicy.saving
          : SETTINGS.cancellationPolicy.saveButton}
      </Button>
    </form>
  );
}
