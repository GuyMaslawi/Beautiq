"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  updatePublicProfileAction,
  PublicProfileFormState,
} from "@/server/public-page/actions";

const INITIAL: PublicProfileFormState = {};

export function PublicProfileForm({
  action,
  initialValues,
}: {
  action: typeof updatePublicProfileAction;
  initialValues: {
    name: string;
    description: string | null;
    phone: string | null;
    addressNote: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    introMessage: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState({
    name: initialValues.name,
    description: initialValues.description ?? "",
    phone: initialValues.phone ?? "",
    addressNote: initialValues.addressNote ?? "",
    instagramUrl: initialValues.instagramUrl ?? "",
    facebookUrl: initialValues.facebookUrl ?? "",
    introMessage: initialValues.introMessage ?? "",
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
        label={PUBLIC_PAGE.profile.nameLabel}
        htmlFor="name"
        error={state.errors?.name}
      >
        <Input
          id="name"
          name="name"
          placeholder={PUBLIC_PAGE.profile.namePlaceholder}
          value={fields.name}
          onChange={(e) => set("name")(e.target.value)}
        />
      </Field>

      <Field
        label={PUBLIC_PAGE.profile.introMessageLabel}
        htmlFor="introMessage"
      >
        <Textarea
          id="introMessage"
          name="introMessage"
          rows={3}
          placeholder={PUBLIC_PAGE.profile.introMessagePlaceholder}
          value={fields.introMessage}
          onChange={(e) => set("introMessage")(e.target.value)}
        />
      </Field>

      <Field
        label={PUBLIC_PAGE.profile.descriptionLabel}
        htmlFor="description"
      >
        <Textarea
          id="description"
          name="description"
          rows={2}
          placeholder={PUBLIC_PAGE.profile.descriptionPlaceholder}
          value={fields.description}
          onChange={(e) => set("description")(e.target.value)}
        />
      </Field>

      <Field label={PUBLIC_PAGE.profile.phoneLabel} htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          dir="ltr"
          placeholder={PUBLIC_PAGE.profile.phonePlaceholder}
          value={fields.phone}
          onChange={(e) => set("phone")(e.target.value)}
        />
      </Field>

      <Field label={PUBLIC_PAGE.profile.addressLabel} htmlFor="addressNote">
        <Input
          id="addressNote"
          name="addressNote"
          placeholder={PUBLIC_PAGE.profile.addressPlaceholder}
          value={fields.addressNote}
          onChange={(e) => set("addressNote")(e.target.value)}
        />
      </Field>

      <Field label={PUBLIC_PAGE.profile.instagramLabel} htmlFor="instagramUrl">
        <Input
          id="instagramUrl"
          name="instagramUrl"
          type="url"
          dir="ltr"
          placeholder={PUBLIC_PAGE.profile.instagramPlaceholder}
          value={fields.instagramUrl}
          onChange={(e) => set("instagramUrl")(e.target.value)}
        />
      </Field>

      <Field label="פייסבוק (קישור)" htmlFor="facebookUrl">
        <Input
          id="facebookUrl"
          name="facebookUrl"
          type="url"
          dir="ltr"
          placeholder="https://facebook.com/my-business"
          value={fields.facebookUrl}
          onChange={(e) => set("facebookUrl")(e.target.value)}
        />
      </Field>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? PUBLIC_PAGE.profile.saving
          : PUBLIC_PAGE.profile.saveButton}
      </Button>
    </form>
  );
}
