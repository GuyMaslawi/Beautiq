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
    <div className="relative flex items-start justify-between gap-4">
      {/* soft brand glow behind the title */}
      <div
        aria-hidden
        className="brand-glow"
        style={{ top: -28, right: -20, width: 150, height: 150 }}
      />
      <div className="relative min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(201,120,152,0.20) 0%, rgba(157,106,168,0.13) 100%)",
              border: "1px solid rgba(184,107,140,0.20)",
              boxShadow: "0 2px 10px rgba(157,106,168,0.14)",
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
