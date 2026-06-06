"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import {
  LayoutDashboard,
  CalendarDays,
  Users2,
  Sparkles,
  Clock,
  MessageCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/bookings": CalendarDays,
  "/clients": Users2,
  "/services": Sparkles,
  "/availability": Clock,
  "/messages": MessageCircle,
  "/settings": Settings,
};

export function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
              !active && "text-muted hover:text-foreground hover:bg-background-alt",
            )}
            style={
              active
                ? {
                    background: "linear-gradient(135deg, rgba(201,120,152,0.14) 0%, rgba(184,107,140,0.10) 100%)",
                    color: "#b86b8c",
                    boxShadow: "inset 0 0 0 1px rgba(184,107,140,0.18)",
                  }
                : undefined
            }
          >
            {Icon && (
              <Icon
                className="h-4 w-4 shrink-0"
                style={active ? { color: "#b86b8c" } : { color: "var(--muted)" }}
              />
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
