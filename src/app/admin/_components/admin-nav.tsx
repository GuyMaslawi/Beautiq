"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "סקירה" },
  { href: "/admin/businesses", label: "ניהול עסקים" },
  { href: "/admin/clients", label: "ניהול לקוחות" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "sidebar-nav-item whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium",
              isActive && "active",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
