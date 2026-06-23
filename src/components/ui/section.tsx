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
    <div className={cn("aura-card relative overflow-hidden rounded-[1.5rem] p-6 md:p-7", className)}>
      <div className="mb-5 flex items-center gap-2.5">
        {icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--brand-gradient-soft)",
              border: "1px solid rgba(184,107,140,0.16)",
            }}
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
