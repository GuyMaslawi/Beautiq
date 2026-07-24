import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AUTH } from "@/lib/constants/he";
import { getCurrentUser } from "@/server/auth/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
          {AUTH.login.title}
        </h1>
        <p className="text-muted mt-1">{AUTH.login.subtitle}</p>
      </div>

      <LoginForm />

      {process.env.AUTH_GOOGLE_ID ? (
        <div className="mt-6">
          <GoogleButton mode="login" />
        </div>
      ) : null}

      <p className="text-muted mt-6 text-sm">
        {AUTH.login.noAccount}{" "}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          {AUTH.login.signupLink}
        </Link>
      </p>
    </AuthShell>
  );
}
