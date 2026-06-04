import * as React from "react";

/**
 * שדה טופס: תווית, תוכן (קלט) והודעת שגיאה אופציונלית.
 * RTL כברירת מחדל. שומר על אחידות בין כל הטפסים.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-foreground block text-sm font-medium"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-muted text-xs leading-5">{hint}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
