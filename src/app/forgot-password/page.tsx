import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AUTH } from "@/lib/constants/he";
import { getCurrentUser } from "@/server/auth/session";

export const metadata = { title: AUTH.forgotPassword.title };

export default async function ForgotPasswordPage() {
  // מי שכבר מחוברת לא צריכה לשחזר סיסמה.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
          {AUTH.forgotPassword.title}
        </h1>
        <p className="text-muted mt-1">{AUTH.forgotPassword.subtitle}</p>
      </div>

      <ForgotPasswordForm />
    </AuthShell>
  );
}
