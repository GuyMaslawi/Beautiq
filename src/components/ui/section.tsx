import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Section — מיכל סקשן משותף עם כותרת ואייקון.
 * מאחד את שני ה-SectionCard שהיו משוכפלים בדפי "הגדרות" ו"דף ציבורי".
 * משטח לבן, פינות מעוגלות, מסגרת עדינה וצל רך.
 */
interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, icon, action, children, className }: SectionProps) {
  return (
    <div
      className={cn("bg-surface rounded-2xl border p-6", className)}
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
      }}
    >
      <div className="mb-5 flex items-center gap-2.5">
        {icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(184,107,140,0.10)" }}
          >
            {icon}
          </div>
        )}
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {action && <div className="ms-auto shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
