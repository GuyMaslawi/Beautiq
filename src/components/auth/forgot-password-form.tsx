"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, MailCheck } from "lucide-react";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "@/server/auth/actions";
import { AUTH } from "@/lib/constants/he";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const INITIAL: ForgotPasswordState = {};

/**
 * טופס "שכחתי סיסמה".
 *
 * מסך ההצלחה מנוסח במכוון כ"אם קיים חשבון…" ומוצג גם כשלא נמצא חשבון —
 * הודעה שונה בין שני המקרים הייתה הופכת את הטופס למנוע לגילוי אילו כתובות
 * רשומות במערכת.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    INITIAL,
  );
  const [email, setEmail] = useState("");

  if (state.sent) {
    return (
      <div className="space-y-5">
        <div className="aura-card rounded-2xl px-6 py-8 text-center">
          <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            <MailCheck className="h-5 w-5" />
          </span>
          <h2 className="font-display text-foreground mt-4 text-xl font-semibold tracking-tight">
            {AUTH.forgotPassword.sentTitle}
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            {AUTH.forgotPassword.sentBody}
          </p>
          <p className="text-muted mt-3 text-xs">
            {AUTH.forgotPassword.sentHint}
          </p>
        </div>
        <Link
          href="/login"
          className="text-primary block text-center text-sm font-medium hover:underline"
        >
          {AUTH.forgotPassword.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}

      <Field
        label={AUTH.forgotPassword.emailLabel}
        htmlFor="email"
        error={state.errors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={AUTH.forgotPassword.emailPlaceholder}
          iconRight={<Mail className="h-4 w-4" />}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending
          ? AUTH.forgotPassword.submitting
          : AUTH.forgotPassword.submit}
      </Button>

      <Link
        href="/login"
        className="text-muted hover:text-foreground block text-center text-sm transition-colors"
      >
        {AUTH.forgotPassword.backToLogin}
      </Link>
    </form>
  );
}
