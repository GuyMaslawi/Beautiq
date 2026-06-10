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
  RefreshCcw,
  Zap,
  Wallet,
  Globe,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/bookings": CalendarDays,
  "/clients": Users2,
  "/services": Sparkles,
  "/availability": Clock,
  "/bring-back": RefreshCcw,
  "/automations": Zap,
  "/finance": Wallet,
  "/public-page": Globe,
  "/settings": Settings,
  "/admin": ShieldCheck,
};

interface AppNavProps {
  /** When true, renders with light-background styles (e.g. mobile drawer). */
  light?: boolean;
  isAdmin?: boolean;
}

export function AppNav({ light = false, isAdmin = false }: AppNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const adminItem = { href: "/admin", label: "ניהול מערכת" };

  function renderLink(item: { href: string; label: string }) {
    const active = isActive(item.href);
    const Icon = ICONS[item.href];

    if (light) {
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
              style={active ? { color: "#b86b8c" } : { color: "var(--muted)" }}
            />
          )}
          <span className="flex-1">{item.label}</span>
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "sidebar-nav-item flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150",
          active && "active",
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p
            className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: light ? "var(--muted-light)" : "var(--sidebar-fg-faint)" }}
          >
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => renderLink(item))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <div>
          <p
            className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: light ? "var(--muted-light)" : "var(--sidebar-fg-faint)" }}
          >
            אדמין
          </p>
          <div className="flex flex-col gap-0.5">
            {renderLink(adminItem)}
          </div>
        </div>
      )}
    </nav>
  );
}
