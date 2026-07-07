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
      className="relative overflow-hidden py-16 text-center rounded-2xl"
      style={{
        background:
          "linear-gradient(135deg, rgba(253,240,247,0.7) 0%, rgba(243,238,246,0.5) 35%, rgba(255,255,255,1) 75%)",
        border: "1px solid rgba(172,92,127,0.14)",
        boxShadow: "0 4px 18px rgba(124,58,97,0.07)",
      }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: -40,
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(199,111,147,0.10) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      <div className="relative">
        {/* Icon bubble */}
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(199,111,147,0.13) 0%, rgba(172,92,127,0.18) 100%)",
            border: "1px solid rgba(172,92,127,0.18)",
            boxShadow: "0 2px 12px rgba(172,92,127,0.10)",
          }}
        >
          {icon ?? (
            <span className="text-2xl" aria-hidden style={{ color: "#ac5c7f" }}>
              ✦
            </span>
          )}
        </div>

        <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted mx-auto mt-3 max-w-xs text-sm leading-7">{body}</p>

        {cta && ctaHref && (
          <div className="mt-6">
            <Link href={ctaHref}>
              <Button>{cta}</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
