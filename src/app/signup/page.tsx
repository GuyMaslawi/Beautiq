import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import { AUTH } from "@/lib/constants/he";
import { getCurrentUser } from "@/server/auth/session";

export default async function SignupPage() {
  // Already signed in — no reason to register again; go straight to the app.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-foreground text-2xl font-bold">
            {AUTH.signup.title}
          </h1>
          <p className="text-muted mt-1">{AUTH.signup.subtitle}</p>
        </div>

        <SignupForm />

        <p className="text-muted mt-6 text-center text-sm">
          {AUTH.signup.haveAccount}{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            {AUTH.signup.loginLink}
          </Link>
        </p>
      </Card>
    </div>
  );
}
