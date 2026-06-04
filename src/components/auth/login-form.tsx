"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction, type LoginState } from "@/server/auth/actions";
import { AUTH } from "@/lib/constants/he";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const INITIAL: LoginState = {};

/**
 * טופס התחברות. הודעות שגיאה נשארות כלליות ולא חושפות אם האימייל קיים.
 * הערכים שהוקלדו נשמרים, וברגע שהמשתמש מתחיל לתקן השגיאה הכללית נעלמת.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);
  const [values, setValues] = useState({ email: "", password: "" });
  const [edited, setEdited] = useState(false);

  // Reset "edited" during render whenever a new server response arrives, so a
  // fresh error is shown again until the user starts correcting the form.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setEdited(false);
  }

  // Focus the first field on a fresh error (DOM side effect).
  useEffect(() => {
    if (state.formError) document.getElementById("email")?.focus();
  }, [state]);

  const update = (field: "email" | "password") => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setEdited(true);
  };

  const formError = edited ? undefined : state.formError;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {formError && <Alert>{formError}</Alert>}

      <Field label={AUTH.login.emailLabel} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update("email")(e.target.value)}
          placeholder={AUTH.login.emailPlaceholder}
        />
      </Field>

      <Field label={AUTH.login.passwordLabel} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => update("password")(e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? AUTH.login.submitting : AUTH.login.submit}
      </Button>
    </form>
  );
}
