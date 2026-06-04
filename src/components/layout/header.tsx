import { BRAND, DASHBOARD } from "@/lib/constants/he";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/auth/actions";

/**
 * Top header for the authenticated app shell. Shows the brand on mobile (the
 * sidebar carries it on desktop), the current business name, and a sign-out
 * action that is always reachable. RTL: brand/title on the right, sign-out left.
 */
export function Header({ businessName }: { businessName: string | null }) {
  return (
    <header className="border-border bg-surface sticky top-0 z-10 border-b">
      <div className="flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-foreground text-lg font-bold tracking-tight md:hidden">
            {BRAND.name}
          </span>
          {businessName && (
            <span className="text-muted hidden truncate text-sm md:inline">
              {businessName}
            </span>
          )}
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {DASHBOARD.signOut}
          </Button>
        </form>
      </div>
    </header>
  );
}
