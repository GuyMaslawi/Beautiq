import { BRAND, DASHBOARD } from "@/lib/constants/he";
import { AppNav } from "@/components/layout/app-nav";
import { signOutAction } from "@/server/auth/actions";
import { LogOut } from "lucide-react";

function getInitials(name: string | null): string {
  if (!name) return "B";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

export function Sidebar({
  userName,
  businessName,
  isAdmin = false,
}: {
  userName: string | null;
  businessName: string | null;
  isAdmin?: boolean;
}) {
  const initials = getInitials(businessName);

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col overflow-hidden md:flex"
      style={{
        background:
          "linear-gradient(180deg, var(--sidebar-bg-from) 0%, var(--sidebar-bg-to) 100%)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-16 items-center gap-3 px-5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            boxShadow: "0 2px 10px rgba(184,107,140,0.50)",
          }}
        >
          B
        </span>
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--sidebar-fg)" }}
        >
          {BRAND.name}
        </span>
      </div>

      {/* Business identity */}
      {(businessName || userName) && (
        <div
          className="px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,120,152,0.55) 0%, rgba(184,107,140,0.40) 100%)",
                color: "#f0c0d4",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {businessName && (
                <p
                  className="truncate text-sm font-semibold leading-tight"
                  style={{ color: "var(--sidebar-fg)" }}
                >
                  {businessName}
                </p>
              )}
              {userName && (
                <p
                  className="mt-0.5 truncate text-xs"
                  style={{ color: "var(--sidebar-fg-muted)" }}
                >
                  {userName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-hide">
        <AppNav isAdmin={isAdmin} />
      </div>

      {/* Footer: sign out */}
      <div
        className="px-3 pb-4"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <form action={signOutAction}>
          <button
            type="submit"
            className="sidebar-signout mt-3 flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {DASHBOARD.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
