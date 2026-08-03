import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { isTrialLapsed } from "@/lib/subscription/trial";
import { SubscribeClient } from "./subscribe-client";

export const metadata: Metadata = {
  title: "הפעלת המנוי · Allura",
};

/**
 * The paywall shown right after signup. Allura has one plan, so there is nothing
 * to choose here — the owner pays and is in. Only once paid does the app gate
 * (see (app)/layout.tsx) let them into the dashboard. Users who already have a
 * plan — or admins — skip straight to the app.
 */
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const user = await requireCurrentUser();
  if (user.plan || user.isAdmin) redirect("/dashboard");

  // /api/subscription/return שולח לכאן עם pending=1 כשהמשתמשת חזרה מעמוד התשלום
  // אך אישור השרת של Grow טרם נקלט. בלי לקרוא את הפרמטר הזה המסך היה נראה לה
  // כאילו התשלום לא נקלט כלל, והיא הייתה משלמת פעם שנייה.
  const { pending } = await searchParams;

  // getCurrentUser מאפס תפוגה שעברה, ולכן הוא כבר לא יודע לספר שהיא נבעה
  // מתקופת ניסיון שהסתיימה. קריאה קצרה אחת מאפשרת להסביר לבעלת העסק למה היא
  // כאן — ושהנתונים שלה לא נמחקו.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { planExpiresAt: true },
  });
  const trialEnded = isTrialLapsed(account?.planExpiresAt);

  return (
    <SubscribeClient
      userName={user.name ?? null}
      paymentPending={pending === "1"}
      trialEnded={trialEnded}
    />
  );
}
