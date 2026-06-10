import Link from "next/link";
import { requirePlatformAdmin } from "@/server/admin/auth";
import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "#f5f5f7" }}>
      {/* Admin top bar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3"
        style={{
          background: "#1a1a2e",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-6">
          <span className="text-base font-bold tracking-tight text-white">
            Allura Admin
          </span>
          <AdminNav />
        </div>
        <Link
          href="/dashboard"
          className="rounded-full px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          ← חזרה לפלטפורמה
        </Link>
      </header>

      <main className="px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
