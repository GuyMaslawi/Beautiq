import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH } from "@/lib/constants/he";
import { getCurrentUser } from "@/server/auth/session";

export default async function LoginPage() {
  // Already signed in — no reason to log in again; go straight to the app.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-foreground text-2xl font-bold">
            {AUTH.login.title}
          </h1>
          <p className="text-muted mt-1">{AUTH.login.subtitle}</p>
        </div>

        <LoginForm />

        <p className="text-muted mt-6 text-center text-sm">
          {AUTH.login.noAccount}{" "}
          <Link
            href="/signup"
            className="text-primary font-medium hover:underline"
          >
            {AUTH.login.signupLink}
          </Link>
        </p>
      </Card>
    </div>
  );
}
