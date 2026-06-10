import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(201,120,152,0.18) 0%, rgba(184,107,140,0.11) 100%)",
              border: "1px solid rgba(184,107,140,0.20)",
              boxShadow: "0 1px 6px rgba(184,107,140,0.10)",
            }}
          >
            <Icon className="h-5 w-5" style={{ color: "#b86b8c" }} />
          </div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h1>
        </div>
        <p
          className="text-sm leading-6"
          style={{ color: "var(--muted)", paddingRight: "3.25rem" }}
        >
          {subtitle}
        </p>
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}
