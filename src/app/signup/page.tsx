import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AUTH } from "@/lib/constants/he";
import { getCurrentUser } from "@/server/auth/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
          {AUTH.signup.title}
        </h1>
        <p className="text-muted mt-1">{AUTH.signup.subtitle}</p>
      </div>

      <SignupForm />

      {process.env.AUTH_GOOGLE_ID ? (
        <div className="mt-6">
          <GoogleButton mode="signup" />
        </div>
      ) : null}

      <p className="text-muted mt-6 text-sm">
        {AUTH.signup.haveAccount}{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          {AUTH.signup.loginLink}
        </Link>
      </p>
    </AuthShell>
  );
}
