import * as React from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success";

const variantClasses: Record<AlertVariant, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  success: "bg-green-50 text-green-700 border-green-200",
};

/** הודעת מצב לטופס — שגיאה כללית או הצלחה. RTL כברירת מחדל. */
export function Alert({
  variant = "error",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
