"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, CheckCircle2 } from "lucide-react";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/server/auth/actions";
import { AUTH } from "@/lib/constants/he";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const INITIAL: ResetPasswordState = {};

/**
 * טופס קביעת סיסמה חדשה. הטוקן מגיע מה-URL ונשלח כשדה מוסתר; האימות האמיתי
 * שלו נעשה בשרת בלבד (checkResetToken/consumeResetToken).
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    INITIAL,
  );
  const [values, setValues] = useState({ password: "", confirmPassword: "" });

  if (state.success) {
    return (
      <div className="space-y-5">
        <div className="aura-card rounded-2xl px-6 py-8 text-center">
          <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h2 className="font-display text-foreground mt-4 text-xl font-semibold tracking-tight">
            {AUTH.resetPassword.successTitle}
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            {AUTH.resetPassword.successBody}
          </p>
        </div>
        <Link href="/login" className="block">
          <Button className="w-full">{AUTH.resetPassword.goToLogin}</Button>
        </Link>
      </div>
    );
  }

  const update = (field: "password" | "confirmPassword") => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && (
        <div className="space-y-3">
          <Alert>{state.formError}</Alert>
          <Link
            href="/forgot-password"
            className="text-primary block text-center text-sm font-medium hover:underline"
          >
            {AUTH.resetPassword.requestNew}
          </Link>
        </div>
      )}

      <input type="hidden" name="token" value={token} />

      <Field
        label={AUTH.resetPassword.passwordLabel}
        htmlFor="password"
        error={state.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          autoFocus
          value={values.password}
          onChange={(e) => update("password")(e.target.value)}
          iconRight={<Lock className="h-4 w-4" />}
        />
      </Field>

      <Field
        label={AUTH.resetPassword.confirmLabel}
        htmlFor="confirmPassword"
        error={state.errors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => update("confirmPassword")(e.target.value)}
          iconRight={<Lock className="h-4 w-4" />}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? AUTH.resetPassword.submitting : AUTH.resetPassword.submit}
      </Button>
    </form>
  );
}
