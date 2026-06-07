"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/layout/nav-items";
import {
  LayoutDashboard,
  CalendarDays,
  Users2,
  Sparkles,
  Clock,
  MessageCircle,
  HeartHandshake,
  BadgeCheck,
  TrendingUp,
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
  "/retention": HeartHandshake,
  "/reputation": BadgeCheck,
  "/pricing": TrendingUp,
  "/settings": Settings,
};

export function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-light)" }}
          >
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = ICONS[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
                    !active &&
                      "text-muted hover:text-foreground hover:bg-background-alt",
                  )}
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, rgba(201,120,152,0.16) 0%, rgba(184,107,140,0.10) 100%)",
                          color: "#b86b8c",
                          boxShadow: "inset 0 0 0 1px rgba(184,107,140,0.22)",
                        }
                      : undefined
                  }
                >
                  {Icon && (
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={
                        active ? { color: "#b86b8c" } : { color: "var(--muted)" }
                      }
                    />
                  )}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
