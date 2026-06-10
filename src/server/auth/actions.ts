"use server";

import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { signIn, signOut } from "@/server/auth/config";
import {
  validateSignup,
  validateLogin,
  type FieldErrors,
  type SignupField,
} from "@/lib/validation/auth";
import { AUTH } from "@/lib/constants/he";

/**
 * Server actions for authentication. Centralised here so all auth logic lives in
 * one place (see CLAUDE.md §13). Passwords are hashed, never logged, and the
 * stored hash never leaves the server.
 */

export interface SignupState {
  errors?: FieldErrors<SignupField>;
  formError?: string;
}

/**
 * Create an account, sign the user in, and send them into the app.
 *
 * The user lands on /dashboard, which shows the full app shell plus a setup card
 * to create their business — no separate onboarding wizard. On validation /
 * duplicate-email failure we return field errors for the form to render. On
 * success, `signIn` issues a redirect (thrown as NEXT_REDIRECT), which must
 * propagate — so we only swallow genuine errors.
 */
export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = validateSignup({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.ok) return { errors: parsed.errors };

  const { name, email, password } = parsed.value;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { errors: { email: AUTH.errors.emailTaken } };

  try {
    const passwordHash = await hashPassword(password);
    await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (error) {
    // Unique-constraint race: another request registered the same email.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { errors: { email: AUTH.errors.emailTaken } };
    }
    return { formError: AUTH.errors.generic };
  }

  // Signs the user in and redirects into the app (throws NEXT_REDIRECT).
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  });

  // Unreachable in practice — signIn redirects on success.
  return {};
}

export interface LoginState {
  formError?: string;
}

/**
 * Validate credentials and sign in. Login errors are deliberately generic and
 * never reveal whether the email exists (see CLAUDE.md §13). Successful sign-in
 * redirects to /dashboard — the app shell, which shows the business setup card
 * when the user has no business yet.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.ok) return { formError: parsed.errors.form };

  try {
    await signIn("credentials", {
      email: parsed.value.email,
      password: parsed.value.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // A failed sign-in throws AuthError; the redirect on success is NOT an
    // AuthError and must propagate.
    if (error instanceof AuthError) {
      return { formError: AUTH.errors.invalidCredentials };
    }
    throw error;
  }

  return {};
}

/** Sign the current user out and return to the home page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
