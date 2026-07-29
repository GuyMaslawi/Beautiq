"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { AuthError } from "next-auth";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { signIn, signOut } from "@/server/auth/config";
import { logActivity } from "@/server/activity/log";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkPersistentRateLimit } from "@/server/rate-limit/persistent";
import {
  validateSignup,
  validateLogin,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  type FieldErrors,
  type SignupField,
} from "@/lib/validation/auth";
import {
  issuePasswordReset,
  consumeResetToken,
} from "@/server/auth/password-reset";
import { captureError } from "@/lib/logger";
import { AUTH } from "@/lib/constants/he";

// הגבלת קצב על ניסיונות התחברות/הרשמה — הגנת עומק מפני ניחוש סיסמאות (brute-force)
// והצפת בקשות. best-effort פר-מופע serverless (ראו src/lib/rate-limit.ts).
const AUTH_RATE_WINDOW_MS = 10 * 60_000; // חלון של 10 דקות
const LOGIN_RATE_MAX = 10; // עד 10 ניסיונות התחברות לכל IP בחלון
const SIGNUP_RATE_MAX = 5; // הרשמה נדירה יותר — סף נמוך יותר
// תקרה משותפת לכל מופעי השרת (במסד). מעט גבוהה מזו שבזיכרון כדי שמופע עמוס
// בודד לא ייתקל בה ראשון — היא נועדה לתפוס ניסיונות שפוזרו בין מופעים.
const SIGNUP_PERSISTENT_MAX = 8;

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
  // הדלי שבזיכרון הוא פר-מופע serverless, ולכן מכסת ההרשמה בפועל מתרחבת
  // ככל שיש יותר מופעים חיים. דלי משותף במסד נותן תקרה אחת אמיתית ליצירת
  // חשבונות — כל חשבון חדש הוא רשומה ומשתמש פוטנציאלי בשליחת הודעות בתשלום.
  if (
    !(await checkPersistentRateLimit(
      `signup:${ip}`,
      SIGNUP_PERSISTENT_MAX,
      AUTH_RATE_WINDOW_MS,
    ))
  ) {
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

// ---------------------------------------------------------------------------
// שחזור סיסמה ("שכחתי סיסמה")
// ---------------------------------------------------------------------------

/**
 * תקרות לבקשת שחזור. הנקודה הזו שולחת אימייל אמיתי לכתובת שהקוראת בוחרת,
 * ולכן בלי תקרה היא גם מנוע הצפת תיבות דואר על חשבוננו וגם דרך לשרוף את
 * מכסת ספק האימייל. תקרה פר-IP (בולמת פרץ) ופר-כתובת (מונעת הטרדה של
 * בעלת עסק מסוימת מכמה מקורות).
 */
const RESET_REQUEST_IP_MAX = 5;
const RESET_REQUEST_EMAIL_MAX = 3;
const RESET_REQUEST_WINDOW_MS = 15 * 60_000;
/** תקרה משותפת לכל מופעי השרת — הדלי שבזיכרון הוא פר-תהליך. */
const RESET_REQUEST_PERSISTENT_MAX = 5;

/** תקרה על *מימוש* טוקן — מגבילה ניחוש טוקנים בכוח. */
const RESET_SUBMIT_IP_MAX = 10;
const RESET_SUBMIT_WINDOW_MS = 15 * 60_000;

export interface ForgotPasswordState {
  /** מוצג תמיד לאחר שליחה תקינה — זהה בין אם המייל קיים ובין אם לא. */
  sent?: boolean;
  errors?: { email?: string };
  formError?: string;
}

/**
 * שלב 1: בקשת קישור שחזור.
 *
 * מחזיר תמיד את אותה תוצאה כשהקלט תקין — בין אם נמצא חשבון ובין אם לא.
 * אחרת הטופס הזה היה הופך למנוע לגילוי אילו כתובות אימייל רשומות במערכת
 * (user enumeration), וזה מידע שמאפשר תקיפה ממוקדת של בעלות עסק אמיתיות.
 */
export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`pwreset:ip:${ip}`, RESET_REQUEST_IP_MAX, RESET_REQUEST_WINDOW_MS)) {
    return { formError: AUTH.errors.tooManyAttempts };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { errors: { email: AUTH.errors.emailRequired } };
  if (email.length > EMAIL_MAX_LENGTH || !isValidEmail(email)) {
    return { errors: { email: AUTH.errors.invalidEmail } };
  }

  if (
    !checkRateLimit(`pwreset:mail:${email}`, RESET_REQUEST_EMAIL_MAX, RESET_REQUEST_WINDOW_MS) ||
    !(await checkPersistentRateLimit(
      `pwreset:mail:${email}`,
      RESET_REQUEST_PERSISTENT_MAX,
      RESET_REQUEST_WINDOW_MS,
    ))
  ) {
    // גם כאן לא מגלים אם החשבון קיים — פשוט מבקשים להמתין.
    return { formError: AUTH.errors.tooManyAttempts };
  }

  try {
    await issuePasswordReset(email);
  } catch (err) {
    // כשל פנימי נרשם, אך התשובה נשארת אחידה: הודעת שגיאה שונה עבור כתובת
    // קיימת מול לא-קיימת היא בדיוק ההדלפה שאנחנו מונעים.
    captureError("auth.passwordResetRequest", err);
  }

  await logActivity({
    category: "auth",
    action: "auth.password_reset_requested",
    summary: "התבקש איפוס סיסמה",
    userId: null,
    actorType: "system",
    businessId: null,
  });

  return { sent: true };
}

export interface ResetPasswordState {
  errors?: { password?: string; confirmPassword?: string };
  formError?: string;
  success?: boolean;
}

/**
 * שלב 2: קביעת סיסמה חדשה בעזרת הטוקן.
 *
 * מימוש מוצלח גם מבטל כל סשן קיים של החשבון (consumeResetToken חותם
 * sessionsValidFrom) — כך ששחזור סיסמה בעקבות פריצה באמת מוציא את התוקף,
 * ולא רק משנה אישור שהוא כבר לא צריך.
 */
export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`pwreset:submit:${ip}`, RESET_SUBMIT_IP_MAX, RESET_SUBMIT_WINDOW_MS)) {
    return { formError: AUTH.errors.tooManyAttempts };
  }

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const errors: ResetPasswordState["errors"] = {};
  if (!password) errors.password = AUTH.errors.passwordRequired;
  else if (password.length < PASSWORD_MIN_LENGTH)
    errors.password = AUTH.errors.passwordTooShort;
  else if (password.length > PASSWORD_MAX_LENGTH)
    errors.password = AUTH.errors.passwordTooLong;

  if (!confirmPassword) errors.confirmPassword = AUTH.errors.confirmRequired;
  else if (!errors.password && password !== confirmPassword)
    errors.confirmPassword = AUTH.errors.passwordsMismatch;

  if (Object.keys(errors).length > 0) return { errors };

  let state;
  try {
    state = await consumeResetToken(token, password);
  } catch (err) {
    captureError("auth.passwordResetConsume", err);
    return { formError: AUTH.errors.generic };
  }

  if (!state.valid) {
    return { formError: AUTH.resetPassword.invalidToken[state.reason] };
  }

  await logActivity({
    category: "auth",
    action: "auth.password_reset_completed",
    summary: "סיסמה אופסה בהצלחה על ידי בעלת החשבון",
    userId: state.userId,
    actorType: "owner",
    businessId: null,
  });

  return { success: true };
}
