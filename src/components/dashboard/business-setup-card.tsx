"use client";

import { useActionState, useEffect } from "react";
import {
  createBusinessAction,
  type BusinessStepState,
} from "@/server/business/actions";
import { Sparkles } from "lucide-react";
import { DASHBOARD } from "@/lib/constants/he";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FadeIn } from "@/components/ui/animate";
import { PremiumPageShell } from "@/components/premium";

const INITIAL: BusinessStepState = {};

export function BusinessSetupCard() {
  const [state, formAction, isPending] = useActionState(
    createBusinessAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.created) {
      // Full page reload ensures the session and server components both see
      // the new business, avoiding any router-cache edge cases.
      window.location.replace("/dashboard");
    }
  }, [state.created]);

  return (
    <PremiumPageShell tint="blush" width="narrow">
      <FadeIn className="mx-auto w-full max-w-lg">
        {/* Welcome heading */}
        <div className="mb-8 text-center">
          {/* Jewel mark */}
          <div
            className="ring-soft bg-brand-gradient mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{ boxShadow: "var(--brand-shadow)" }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-display text-foreground text-[1.75rem] font-semibold tracking-tight">
            {DASHBOARD.setup.title}
          </h1>
          <p className="mt-1 font-medium" style={{ color: "var(--primary)" }}>
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
    </PremiumPageShell>
  );
}
