"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * מסך שגיאה לעמוד ההזמנות הציבורי.
 *
 * בלעדיו, תקלה בעמוד הזה מגיעה למי שהכי פחות אמורה לראות אותה — הלקוחה של
 * העסק, שרק ניסתה לקבוע תור. הטקסט מכוון אליה: בלי ז'רגון, בלי פרטי שגיאה,
 * ועם הצעה מעשית (ליצור קשר עם העסק ישירות). אין כאן שום פרט על העסק.
 */
export default function PublicBusinessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="app-ambient flex min-h-screen items-center justify-center p-6"
      dir="rtl"
    >
      <div className="aura-card w-full max-w-sm rounded-[1.75rem] px-8 py-10 text-center">
        <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
          <RefreshCcw className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          העמוד לא נטען
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          אירעה תקלה זמנית. אפשר לנסות שוב בעוד רגע, או ליצור קשר ישירות עם
          העסק כדי לקבוע תור.
        </p>
        <Button onClick={reset} className="mt-6">
          לנסות שוב
        </Button>
      </div>
    </main>
  );
}
