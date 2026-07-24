"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { signIn, signOut } from "@/server/auth/config";
import { logActivity } from "@/server/activity/log";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  validateSignup,
  validateLogin,
  type FieldErrors,
  type SignupField,
} from "@/lib/validation/auth";
import { AUTH } from "@/lib/constants/he";

// הגבלת קצב על ניסיונות התחברות/הרשמה — הגנת עומק מפני ניחוש סיסמאות (brute-force)
// והצפת בקשות. best-effort פר-מופע serverless (ראו src/lib/rate-limit.ts).
const AUTH_RATE_WINDOW_MS = 10 * 60_000; // חלון של 10 דקות
const LOGIN_RATE_MAX = 10; // עד 10 ניסיונות התחברות לכל IP בחלון
const SIGNUP_RATE_MAX = 5; // הרשמה נדירה יותר — סף נמוך יותר

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
 * Create an account, sign the user in, and send them to choose a plan.
 *
 * Right after signup the user lands on /subscribe, where they pick and pay for a
 * plan (Premium or Platinum) before the app opens. Only once paid does the app
 * gate let them into /dashboard. On validation / duplicate-email failure we
 * return field errors for the form to render. On success, `signIn` issues a
 * redirect (thrown as NEXT_REDIRECT), which must propagate — so we only swallow
 * genuine errors.
 */
export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`signup:${ip}`, SIGNUP_RATE_MAX, AUTH_RATE_WINDOW_MS)) {
    return { formError: AUTH.errors.tooManyAttempts };
  }

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
    const newUser = await prisma.user.create({ data: { name, email, passwordHash } });
    await logActivity({
      category: "auth",
      action: "auth.signup",
      summary: `נרשם משתמש חדש: ${email}`,
      userId: newUser.id,
      actorType: "owner",
      businessId: null,
    });
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

  // Signs the user in and redirects to plan selection (throws NEXT_REDIRECT).
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/subscribe",
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
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`login:${ip}`, LOGIN_RATE_MAX, AUTH_RATE_WINDOW_MS)) {
    return { formError: AUTH.errors.tooManyAttempts };
  }

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

/**
 * Start the "Sign in with Google" flow. Redirects to Google's consent screen
 * (throws NEXT_REDIRECT); on return, the Google callback resolves/creates our
 * own User row (see config.ts) and lands the user on /dashboard. New accounts
 * have no plan yet, so the app gate bounces them to /subscribe — same as a fresh
 * email signup. Used by both the login and signup pages.
 */
export async function googleSignInAction(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

/** Sign the current user out and return to the home page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
