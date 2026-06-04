"use client";

import { useActionState, useEffect, useState } from "react";
import { signupAction, type SignupState } from "@/server/auth/actions";
import type { SignupField } from "@/lib/validation/auth";
import { AUTH } from "@/lib/constants/he";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const INITIAL: SignupState = {};

// Field order — also the priority for focusing the first invalid field.
const FIELDS = ["name", "email", "password", "confirmPassword"] as const;

/**
 * טופס יצירת חשבון. ולידציה אמיתית מתבצעת בצד השרת.
 * הערכים שהוקלדו נשמרים גם כשמתקבלת שגיאה, וברגע שהמשתמש מתקן שדה
 * השגיאה שלו (ושגיאה כללית) נעלמת — כדי שהתיקון יהיה ברור ונעים.
 */
export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, INITIAL);
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [edited, setEdited] = useState<Partial<Record<SignupField, boolean>>>(
    {},
  );

  // Each submit returns a fresh state object. Reset "edited" during render
  // (React's pattern for resetting state when an input changes) so the new
  // server errors show again until the user starts fixing a field.
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setEdited({});
  }

  // Move focus to the first invalid field for quick correction (DOM side effect).
  useEffect(() => {
    const firstInvalid = FIELDS.find((field) => state.errors?.[field]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
  }, [state]);

  const update = (field: SignupField) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setEdited((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  // Hide a field error once the user starts fixing it.
  const errorFor = (field: SignupField) =>
    edited[field] ? undefined : state.errors?.[field];
  // Any edit clears a previous general (non-field) error too.
  const formError =
    Object.keys(edited).length === 0 ? state.formError : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {formError && <Alert>{formError}</Alert>}

      <Field
        label={AUTH.signup.nameLabel}
        htmlFor="name"
        error={errorFor("name")}
      >
        <Input
          id="name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => update("name")(e.target.value)}
          placeholder={AUTH.signup.namePlaceholder}
        />
      </Field>

      <Field
        label={AUTH.signup.emailLabel}
        htmlFor="email"
        error={errorFor("email")}
      >
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update("email")(e.target.value)}
          placeholder={AUTH.signup.emailPlaceholder}
        />
      </Field>

      <Field
        label={AUTH.signup.passwordLabel}
        htmlFor="password"
        error={errorFor("password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => update("password")(e.target.value)}
        />
      </Field>

      <Field
        label={AUTH.signup.confirmPasswordLabel}
        htmlFor="confirmPassword"
        error={errorFor("confirmPassword")}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => update("confirmPassword")(e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? AUTH.signup.submitting : AUTH.signup.submit}
      </Button>
    </form>
  );
}
