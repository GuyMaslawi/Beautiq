"use client";

import { useActionState, useState } from "react";
import {
  createBusinessAction,
  type BusinessStepState,
} from "@/server/business/actions";
import { DASHBOARD } from "@/lib/constants/he";
import { slugify } from "@/lib/slug";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const INITIAL: BusinessStepState = {};

/**
 * State A — the signed-in user has no business yet. A warm, in-app setup card
 * (not a separate wizard) that asks only for the minimum: name + public slug.
 * The slug is suggested from the name and remains editable.
 */
export function BusinessSetupCard() {
  const [state, formAction, isPending] = useActionState(
    createBusinessAction,
    INITIAL,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Once the owner edits the slug we stop overwriting it from the name.
  const [slugTouched, setSlugTouched] = useState(false);

  const handleName = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {DASHBOARD.setup.title}
        </h1>
        <p className="text-primary mt-1 font-medium">
          {DASHBOARD.setup.subtitle}
        </p>
        <p className="text-muted mt-3 leading-7">{DASHBOARD.setup.body}</p>
      </div>

      <Card>
        <form action={formAction} className="space-y-5" noValidate>
          {state.formError && <Alert>{state.formError}</Alert>}

          <Field
            label={DASHBOARD.setup.nameLabel}
            htmlFor="name"
            error={state.errors?.name}
          >
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => handleName(e.target.value)}
              placeholder={DASHBOARD.setup.namePlaceholder}
            />
          </Field>

          <Field
            label={DASHBOARD.setup.slugLabel}
            htmlFor="slug"
            error={state.errors?.slug}
            hint={DASHBOARD.setup.slugHelp}
          >
            <Input
              id="slug"
              name="slug"
              dir="ltr"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="my-studio"
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {DASHBOARD.setup.submit}
          </Button>
        </form>
      </Card>
    </div>
  );
}
