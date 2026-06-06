"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type { BusinessDetailsFormState } from "@/server/settings/actions";
import type { updateBusinessDetailsAction } from "@/server/settings/actions";

const INITIAL: BusinessDetailsFormState = {};

export function BusinessDetailsForm({
  action,
  initialValues,
}: {
  action: typeof updateBusinessDetailsAction;
  initialValues: {
    name: string;
    phone: string | null;
    city: string | null;
    description: string | null;
    addressNote: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState({
    name: initialValues.name,
    phone: initialValues.phone ?? "",
    city: initialValues.city ?? "",
    description: initialValues.description ?? "",
    addressNote: initialValues.addressNote ?? "",
  });

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && (
        <Alert>{state.formError}</Alert>
      )}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <Field
        label={SETTINGS.businessDetails.nameLabel}
        htmlFor="name"
        error={state.errors?.name}
      >
        <Input
          id="name"
          name="name"
          placeholder={SETTINGS.businessDetails.namePlaceholder}
          value={fields.name}
          onChange={(e) => set("name")(e.target.value)}
          required
        />
      </Field>

      <Field
        label={SETTINGS.businessDetails.phoneLabel}
        htmlFor="phone"
        error={state.errors?.phone}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder={SETTINGS.businessDetails.phonePlaceholder}
          value={fields.phone}
          onChange={(e) => set("phone")(e.target.value)}
          dir="ltr"
        />
      </Field>

      <Field
        label={SETTINGS.businessDetails.cityLabel}
        htmlFor="city"
      >
        <Input
          id="city"
          name="city"
          placeholder={SETTINGS.businessDetails.cityPlaceholder}
          value={fields.city}
          onChange={(e) => set("city")(e.target.value)}
        />
      </Field>

      <Field
        label={SETTINGS.businessDetails.descriptionLabel}
        htmlFor="description"
      >
        <Textarea
          id="description"
          name="description"
          placeholder={SETTINGS.businessDetails.descriptionPlaceholder}
          rows={3}
          value={fields.description}
          onChange={(e) => set("description")(e.target.value)}
        />
      </Field>

      <Field
        label={SETTINGS.businessDetails.addressNoteLabel}
        htmlFor="addressNote"
      >
        <Input
          id="addressNote"
          name="addressNote"
          placeholder={SETTINGS.businessDetails.addressNotePlaceholder}
          value={fields.addressNote}
          onChange={(e) => set("addressNote")(e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending
          ? SETTINGS.businessDetails.saving
          : SETTINGS.businessDetails.saveButton}
      </Button>
    </form>
  );
}
