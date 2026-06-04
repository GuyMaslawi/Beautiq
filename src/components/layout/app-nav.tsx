"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Primary navigation links with active-state highlighting. Rendered both in the
 * desktop sidebar (vertical) and in the mobile strip (horizontal). The active
 * route is matched by exact path or by a nested path under it.
 */
export function AppNav({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        variant === "sidebar"
          ? "flex flex-col gap-1"
          : "flex gap-2 overflow-x-auto",
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
              variant === "sidebar" ? "px-4 py-2.5" : "px-4 py-2",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-background",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
