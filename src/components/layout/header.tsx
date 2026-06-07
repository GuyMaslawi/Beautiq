"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu,
  X,
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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/server/auth/actions";
import { BRAND, DASHBOARD } from "@/lib/constants/he";
import { NAV_GROUPS } from "@/components/layout/nav-items";

const NAV_ICONS: Record<string, LucideIcon> = {
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

function getInitials(name: string | null): string {
  if (!name) return "B";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

export function Header({ businessName }: { businessName: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = getInitials(businessName);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Top bar — visible on mobile only; desktop has sidebar */}
      <header
        className="border-border bg-surface/95 sticky top-0 z-30 border-b backdrop-blur-sm md:hidden"
        style={{ boxShadow: "var(--shadow-xs)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2 no-underline">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                boxShadow: "0 2px 6px rgba(184,107,140,0.30)",
              }}
            >
              B
            </span>
            <span className="text-foreground text-base font-bold tracking-tight">
              {BRAND.name}
            </span>
          </Link>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-foreground flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-background-alt"
            aria-label="פתח תפריט"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Drawer — slides in from the right (RTL) */}
            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-surface md:hidden"
              style={{ boxShadow: "var(--shadow-xl)" }}
            >
              {/* Drawer header */}
              <div
                className="flex h-14 items-center justify-between px-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
                    style={{
                      background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                      boxShadow: "0 2px 6px rgba(184,107,140,0.30)",
                    }}
                  >
                    B
                  </span>
                  <span className="text-foreground text-base font-bold tracking-tight">
                    {BRAND.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-background-alt"
                  aria-label="סגור תפריט"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Business avatar strip */}
              {businessName && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(201,120,152,0.22) 0%, rgba(184,107,140,0.15) 100%)",
                      color: "#b86b8c",
                      border: "1px solid rgba(184,107,140,0.20)",
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {businessName}
                    </p>
                    <p className="text-muted text-xs">{DASHBOARD.headerSubtitle}</p>
                  </div>
                </div>
              )}

              {/* Grouped nav */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p
                      className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--muted-light)" }}
                    >
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        const Icon = NAV_ICONS[item.href];
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-150"
                            style={
                              active
                                ? {
                                    background:
                                      "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                                    color: "#fff",
                                    boxShadow:
                                      "0 1px 4px rgba(184,107,140,0.28)",
                                  }
                                : { color: "var(--muted)" }
                            }
                          >
                            {Icon && (
                              <Icon
                                className="h-4.5 w-4.5 shrink-0"
                                style={
                                  active
                                    ? { color: "rgba(255,255,255,0.9)" }
                                    : { color: "var(--muted)" }
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

              {/* Footer: sign out */}
              <div
                className="px-3 py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="text-muted hover:text-error flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors hover:bg-error-light"
                  >
                    <LogOut className="h-4.5 w-4.5 shrink-0" />
                    {DASHBOARD.signOut}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
