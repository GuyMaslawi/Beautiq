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
  Settings,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/server/auth/actions";
import { BRAND, NAV, DASHBOARD } from "@/lib/constants/he";

const NAV_ICONS = {
  "/dashboard": LayoutDashboard,
  "/bookings": CalendarDays,
  "/clients": Users2,
  "/services": Sparkles,
  "/availability": Clock,
  "/messages": MessageCircle,
  "/settings": Settings,
} as const;

const NAV_ITEMS = [
  { href: "/dashboard", label: NAV.dashboard },
  { href: "/bookings", label: NAV.bookings },
  { href: "/clients", label: NAV.clients },
  { href: "/services", label: NAV.services },
  { href: "/availability", label: NAV.availability },
  { href: "/messages", label: NAV.messages },
  { href: "/settings", label: NAV.settings },
] as const;

export function Header({
  businessName,
}: {
  businessName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header
        className="border-border bg-surface/95 sticky top-0 z-30 border-b backdrop-blur-sm"
        style={{ boxShadow: "var(--shadow-xs)" }}
      >
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Mobile: brand + hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            {/* Brand mark */}
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
          </div>

          {/* Desktop: business identity */}
          <div className="hidden flex-col justify-center md:flex">
            {businessName ? (
              <>
                <span className="text-foreground truncate text-sm font-bold tracking-tight">
                  {businessName}
                </span>
                <span className="text-muted text-xs">{DASHBOARD.headerSubtitle}</span>
              </>
            ) : (
              <span className="text-foreground truncate text-sm font-semibold">
                {DASHBOARD.headerNoBusinessTitle}
              </span>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Desktop sign out */}
            <form action={signOutAction} className="hidden md:block">
              <button
                type="submit"
                className="text-muted hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-background-alt"
              >
                <LogOut className="h-4 w-4" />
                {DASHBOARD.signOut}
              </button>
            </form>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-foreground flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-background-alt md:hidden"
              aria-label="פתח תפריט"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
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

            {/* Drawer — slides from right in RTL */}
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
              <div className="border-border flex h-16 items-center justify-between border-b px-5">
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

              {/* Business name */}
              {businessName && (
                <div className="border-border border-b px-5 py-3">
                  <p className="text-foreground text-sm font-semibold">{businessName}</p>
                  <p className="text-muted text-xs">{DASHBOARD.headerSubtitle}</p>
                </div>
              )}

              {/* Nav items */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-1">
                  {NAV_ITEMS.map((item) => {
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
                                background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                                color: "#fff",
                                boxShadow: "0 1px 4px rgba(184,107,140,0.25)",
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className="h-4.5 w-4.5 shrink-0"
                          style={
                            active
                              ? { color: "rgba(255,255,255,0.9)" }
                              : { color: "var(--muted)" }
                          }
                        />
                        <span
                          className={
                            active ? "text-white" : "text-muted"
                          }
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Drawer footer: sign out */}
              <div className="border-border border-t px-3 py-4">
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
