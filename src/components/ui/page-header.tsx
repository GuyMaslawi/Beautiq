import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

/**
 * Shared premium page header used across all CRM pages.
 * Renders an icon badge, bold title, descriptive subtitle, and an optional CTA slot.
 */
export function PageHeader({ icon: Icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(201,120,152,0.15) 0%, rgba(184,107,140,0.10) 100%)",
              border: "1px solid rgba(184,107,140,0.18)",
              boxShadow: "0 1px 4px rgba(184,107,140,0.08)",
            }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color: "#b86b8c" }} />
          </div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-muted text-sm leading-6" style={{ paddingRight: "3rem" }}>
          {subtitle}
        </p>
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}
