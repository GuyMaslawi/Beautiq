import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Editorial header band shared by the "new service" and "edit service" pages,
 * so both entry points into ServiceForm open with exactly the same composition
 * (breadcrumb → eyebrow → title → supporting line) as the rest of the app.
 */
export function ServicePageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="aura-card relative overflow-hidden rounded-[1.5rem] p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-14 h-40 w-40 rounded-full"
        style={{
          insetInlineEnd: "-2rem",
          background: "radial-gradient(circle, rgba(192,149,96,0.18) 0%, transparent 70%)",
          filter: "blur(14px)",
        }}
      />
      <div className="relative">
        <div className="mb-2 flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
          <Link
            href="/services"
            className="transition-colors hover:underline"
            style={{ color: "var(--muted)" }}
          >
            שירותים
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="eyebrow" style={{ color: "#b88a3e" }}>
            {eyebrow}
          </span>
        </div>
        <h1 className="display-num text-foreground text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
