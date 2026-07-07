"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// מסך שגיאה כללי לעמודי האפליקציה — נקי, מרגיע, עם דרך חזרה ברורה.
export default function AppError({
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
    <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
      <div className="aura-card relative max-w-md rounded-[1.75rem] px-8 py-10 text-center">
        <span className="brand-chip mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
          <RefreshCcw className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold text-foreground">
          משהו השתבש
        </h1>
        <p className="mt-2.5 text-sm leading-7 text-muted">
          אירעה שגיאה בלתי צפויה. אפשר לנסות שוב — ואם זה חוזר על עצמו, נשמח לעזור.
        </p>
        <Button onClick={reset} className="mt-6">
          לנסות שוב
        </Button>
      </div>
    </div>
  );
}
