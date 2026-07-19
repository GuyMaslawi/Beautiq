"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/server/auth/actions";
import { BRAND, DASHBOARD } from "@/lib/constants/he";
import { AppNav } from "@/components/layout/app-nav";

function getInitials(name: string | null): string {
  if (!name) return "B";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

export function Header({ businessName, isAdmin = false }: { businessName: string | null; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(businessName);

  return (
    <>
      {/* Top bar — visible on mobile only */}
      <header
        className="sticky top-0 z-30 md:hidden"
        style={{
          background:
            "linear-gradient(120deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-mid) 55%, var(--sidebar-bg-to) 100%)",
          borderBottom: "1px solid var(--sidebar-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2 no-underline">
            <span className="brand-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
              B
            </span>
            <span
              className="text-base font-bold tracking-tight"
              style={{ color: "var(--sidebar-fg)" }}
            >
              {BRAND.name}
            </span>
          </Link>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition-colors"
            style={{ color: "var(--sidebar-fg)" }}
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
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Drawer — slides in from the right (RTL) */}
            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col md:hidden"
              style={{
                background:
                  "linear-gradient(170deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-mid) 48%, var(--sidebar-bg-to) 100%)",
                boxShadow: "var(--shadow-xl)",
              }}
            >
              {/* Drawer header */}
              <div
                className="flex h-14 items-center justify-between px-4"
                style={{ borderBottom: "1px solid var(--sidebar-border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="brand-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                    B
                  </span>
                  <span
                    className="text-base font-bold tracking-tight"
                    style={{ color: "var(--sidebar-fg)" }}
                  >
                    {BRAND.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
                  style={{ color: "var(--sidebar-fg-muted)" }}
                  aria-label="סגור תפריט"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Business avatar strip */}
              {businessName && (
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: "1px solid var(--sidebar-border)" }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: "var(--brand-gradient)",
                      color: "#ffffff",
                      boxShadow: "0 2px 8px rgba(172,92,127,0.35)",
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--sidebar-fg)" }}
                    >
                      {businessName}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--sidebar-fg-muted)" }}
                    >
                      {DASHBOARD.headerSubtitle}
                    </p>
                  </div>
                </div>
              )}

              {/* Grouped nav */}
              <nav
                className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide"
                onClick={() => setOpen(false)}
              >
                <AppNav isAdmin={isAdmin} />
              </nav>

              {/* Footer: sign out */}
              <div
                className="px-3 pb-4"
                style={{ borderTop: "1px solid var(--sidebar-border)" }}
              >
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="sidebar-signout mt-3 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all"
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
