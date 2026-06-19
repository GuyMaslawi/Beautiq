import type { ReactNode } from "react";

/**
 * Labeled dashboard section wrapper. Gives each business-priority area
 * (היום / הכנסות / הזדמנויות / אוטומציות) a clear title so owners can scan
 * the dashboard by what they want to do, not by feature name.
 */
export function DashboardSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
