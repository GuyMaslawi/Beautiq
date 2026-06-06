import * as React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  body: string;
  cta?: string;
  ctaHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, body, cta, ctaHref, icon }: EmptyStateProps) {
  return (
    <div
      className="py-16 text-center rounded-2xl"
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(43,37,48,0.06)",
      }}
    >
      {/* Icon */}
      <div
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(201,120,152,0.10) 0%, rgba(184,107,140,0.16) 100%)",
          border: "1px solid rgba(184,107,140,0.15)",
          boxShadow: "0 2px 8px rgba(184,107,140,0.08)",
        }}
      >
        {icon ?? (
          <span className="text-2xl" aria-hidden style={{ color: "#b86b8c" }}>
            ✦
          </span>
        )}
      </div>

      <h2 className="text-foreground text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-muted mx-auto mt-3 max-w-xs text-sm leading-7">{body}</p>

      {cta && ctaHref && (
        <div className="mt-6">
          <Link href={ctaHref}>
            <Button>{cta}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
