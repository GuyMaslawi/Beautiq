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
}: {
  userName: string | null;
  businessName: string | null;
}) {
  const initials = getInitials(businessName);

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col md:flex"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fefcfd 100%)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-16 items-center gap-3 px-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            boxShadow: "0 2px 10px rgba(184,107,140,0.34)",
          }}
        >
          B
        </span>
        <span className="text-foreground text-lg font-bold tracking-tight">
          {BRAND.name}
        </span>
      </div>

      {/* Business identity */}
      {(businessName || userName) && (
        <div
          className="px-4 py-3.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
              style={{
                background:
                  "linear-gradient(135deg, rgba(201,120,152,0.22) 0%, rgba(184,107,140,0.15) 100%)",
                color: "#b86b8c",
                border: "1px solid rgba(184,107,140,0.22)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              {businessName && (
                <p className="text-foreground truncate text-sm font-semibold leading-tight">
                  {businessName}
                </p>
              )}
              {userName && (
                <p className="text-muted mt-0.5 truncate text-xs">{userName}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AppNav />
      </div>

      {/* Footer: sign out */}
      <div
        className="px-3 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-muted hover:text-error flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-error-light"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {DASHBOARD.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
