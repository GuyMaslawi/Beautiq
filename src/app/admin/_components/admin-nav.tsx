"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "סקירה" },
  { href: "/admin/businesses", label: "ניהול עסקים" },
  { href: "/admin/clients", label: "ניהול לקוחות" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              isActive
                ? { background: "rgba(255,255,255,0.15)", color: "#fff" }
                : { color: "rgba(255,255,255,0.65)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
