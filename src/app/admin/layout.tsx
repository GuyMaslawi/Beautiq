import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div dir="rtl" className="app-ambient min-h-screen">
      {/* Admin top bar — dark plum, same language as the app sidebar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-mid) 55%, var(--sidebar-bg-to) 100%)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2.5">
            <span className="brand-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <span
                className="block text-sm font-bold tracking-tight"
                style={{ color: "var(--sidebar-fg)" }}
              >
                Allura
              </span>
              <span
                className="eyebrow block"
                style={{ color: "var(--sidebar-fg-muted)", fontSize: "0.625rem" }}
              >
                ניהול מערכת
              </span>
            </div>
          </div>
          <AdminNav />
        </div>
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
          style={{
            color: "var(--sidebar-fg-muted)",
            borderColor: "var(--sidebar-border)",
          }}
        >
          חזרה לפלטפורמה
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <main className="px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
