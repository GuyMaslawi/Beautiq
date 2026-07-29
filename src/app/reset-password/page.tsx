import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { AUTH } from "@/lib/constants/he";
import { checkResetToken } from "@/server/auth/password-reset";

export const metadata = { title: AUTH.resetPassword.title };

/**
 * עמוד קביעת סיסמה חדשה.
 *
 * הטוקן נבדק כבר ברינדור כדי שקישור פג/מנוצל יציג שגיאה ברורה מיד, ולא רק
 * אחרי שהמשתמשת טרחה להקליד סיסמה פעמיים. זו נוחות בלבד — האימות המחייב
 * קורה שוב בשרת בזמן המימוש (consumeResetToken), שם הוא גם אטומי.
 *
 * המצב מכוון: אין כאן שום דבר שתלוי בסשן, ולכן העמוד ציבורי (ראו את רשימת
 * ההיתר ב-middleware).
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  const state = token
    ? await checkResetToken(token)
    : ({ valid: false, reason: "invalid" } as const);

  if (!state.valid) {
    return (
      <AuthShell>
        <div className="mb-8">
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
            {AUTH.resetPassword.title}
          </h1>
        </div>
        <div className="space-y-4">
          <Alert>{AUTH.resetPassword.invalidToken[state.reason]}</Alert>
          <Link
            href="/forgot-password"
            className="text-primary block text-center text-sm font-medium hover:underline"
          >
            {AUTH.resetPassword.requestNew}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
          {AUTH.resetPassword.title}
        </h1>
        <p className="text-muted mt-1">{AUTH.resetPassword.subtitle}</p>
      </div>

      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
