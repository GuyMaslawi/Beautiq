import { AUTH } from "@/lib/constants/he";

/**
 * Lightweight, dependency-free validation for the auth forms.
 *
 * Server-side validation is the source of truth (see CLAUDE.md §17). Each
 * validator returns a normalized payload on success, or a map of field → Hebrew
 * error message on failure, so callers can render messages next to the inputs.
 */

export const PASSWORD_MIN_LENGTH = 8;
/**
 * תקרת אורך לסיסמה. bcrypt מתעלם ממילא מכל מה שמעבר ל-72 בתים, ולכן סיסמה
 * ארוכה יותר אינה מוסיפה שום ביטחון — היא רק מעבירה מטען שרירותי לפונקציית
 * גיבוב יקרה בנקודת קצה אנונימית. גבול נדיב אך מפורש.
 */
export const PASSWORD_MAX_LENGTH = 200;
/** תקרת אורך לשם. נשמר בעמודת `text` ומוצג בכל האפליקציה. */
export const NAME_MAX_LENGTH = 120;
/** תקרת אורך לכתובת אימייל (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

// Pragmatic email shape check — intentionally permissive, real verification is
// out of scope for V1.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the string is a plausibly-valid email address. */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export type FieldErrors<TField extends string> = Partial<
  Record<TField, string>
>;

export type ValidationResult<TValue, TField extends string> =
  | { ok: true; value: TValue }
  | { ok: false; errors: FieldErrors<TField> };

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export type SignupField = "name" | "email" | "password" | "confirmPassword";

export function validateSignup(raw: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult<SignupInput, SignupField> {
  const name = raw.name.trim();
  const email = raw.email.trim().toLowerCase();
  const errors: FieldErrors<SignupField> = {};

  if (!name) errors.name = AUTH.errors.nameRequired;
  else if (name.length > NAME_MAX_LENGTH) errors.name = AUTH.errors.nameTooLong;

  if (!email) errors.email = AUTH.errors.emailRequired;
  else if (email.length > EMAIL_MAX_LENGTH) errors.email = AUTH.errors.invalidEmail;
  else if (!EMAIL_PATTERN.test(email)) errors.email = AUTH.errors.invalidEmail;

  if (!raw.password) errors.password = AUTH.errors.passwordRequired;
  else if (raw.password.length < PASSWORD_MIN_LENGTH)
    errors.password = AUTH.errors.passwordTooShort;
  else if (raw.password.length > PASSWORD_MAX_LENGTH)
    errors.password = AUTH.errors.passwordTooLong;

  if (!raw.confirmPassword) errors.confirmPassword = AUTH.errors.confirmRequired;
  else if (!errors.password && raw.password !== raw.confirmPassword)
    errors.confirmPassword = AUTH.errors.passwordsMismatch;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, password: raw.password } };
}

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginField = "form";

export function validateLogin(raw: {
  email: string;
  password: string;
}): ValidationResult<LoginInput, LoginField> {
  const email = raw.email.trim().toLowerCase();
  // Login errors are deliberately generic ("required") and never reveal whether
  // an email exists (see CLAUDE.md §13).
  if (!email || !raw.password)
    return { ok: false, errors: { form: AUTH.errors.required } };
  // Reject absurd input before it reaches the DB lookup and bcrypt. Neither can
  // ever match (bcrypt ignores past 72 bytes), so this only removes work an
  // anonymous caller could otherwise force on every attempt.
  if (email.length > EMAIL_MAX_LENGTH || raw.password.length > PASSWORD_MAX_LENGTH)
    return { ok: false, errors: { form: AUTH.errors.invalidCredentials } };
  return { ok: true, value: { email, password: raw.password } };
}
