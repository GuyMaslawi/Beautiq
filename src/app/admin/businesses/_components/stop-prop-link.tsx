"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

interface StopPropAProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StopPropA({ href, children, className, style }: StopPropAProps) {
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

interface StopPropLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StopPropLink({ href, children, className, style }: StopPropLinkProps) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}
