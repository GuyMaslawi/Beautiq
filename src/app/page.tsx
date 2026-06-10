import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  redirect("/login");
}
