"use client";

import { useRouter } from "next/navigation";

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ClickableRow({ href, children, className, style }: Props) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className={className}
      style={{ ...style, cursor: "pointer" }}
    >
      {children}
    </tr>
  );
}
