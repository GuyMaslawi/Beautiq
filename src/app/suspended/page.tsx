import type { Metadata } from "next";
import { PauseCircle } from "lucide-react";
import { signOutAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";
import { SUPPORT_EMAIL } from "@/lib/config";

// עמוד ציבורי — הודעת השהיה. מוצג כשחשבון הושהה זמנית ע"י מנהל הפלטפורמה.
// אינו משתמש במעטפת המאומתת (אין גישה לאפליקציה בזמן השהיה).
export const metadata: Metadata = {
  title: "החשבון הושהה — Allura",
};

function formatUntil(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  const until = user?.suspendedUntil ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--warning-light)" }}
        >
          <PauseCircle className="h-7 w-7" style={{ color: "var(--warning)" }} />
        </div>
        <h1 className="font-display mt-4 text-xl font-semibold text-foreground">
          החשבון הושהה זמנית
        </h1>
        <p className="mt-2 text-sm text-muted">
          הגישה לחשבון שלך הושהתה על ידי צוות Allura.
          {until && (
            <>
              {" "}
              ההשהיה בתוקף עד <span className="font-semibold">{formatUntil(until)}</span>.
            </>
          )}
        </p>
        <p className="mt-4 text-sm text-muted">
          לפרטים או לשחרור מוקדם, אפשר לפנות אלינו:
          <br />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <form action={signOutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl border border-border bg-background-alt px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            התנתקות
          </button>
        </form>
      </div>
    </main>
  );
}
