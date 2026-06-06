"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createBusinessAction,
  type BusinessStepState,
} from "@/server/business/actions";
import { DASHBOARD } from "@/lib/constants/he";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FadeIn } from "@/components/ui/animate";

const INITIAL: BusinessStepState = {};

export function BusinessSetupCard() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createBusinessAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.created) router.refresh();
  }, [state.created, router]);

  return (
    <FadeIn className="mx-auto w-full max-w-lg">
      {/* Welcome heading */}
      <div className="mb-8 text-center">
        {/* Jewel mark */}
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white text-xl font-bold"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            boxShadow: "0 4px 16px rgba(184,107,140,0.30)",
          }}
        >
          B
        </div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {DASHBOARD.setup.title}
        </h1>
        <p
          className="mt-1 font-medium"
          style={{ color: "#b86b8c" }}
        >
          {DASHBOARD.setup.subtitle}
        </p>
        <p className="text-muted mx-auto mt-3 max-w-sm text-sm leading-7">
          {DASHBOARD.setup.body}
        </p>
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
              placeholder={DASHBOARD.setup.namePlaceholder}
              autoFocus
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "יוצרים…" : DASHBOARD.setup.submit}
          </Button>
        </form>
      </Card>
    </FadeIn>
  );
}
