import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.isAdmin ?? false;
}

/** Redirects to /dashboard if the current user is not a platform admin. */
export async function requirePlatformAdmin(): Promise<void> {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) redirect("/dashboard");
}
