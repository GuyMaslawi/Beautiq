import { BRAND } from "@/lib/constants/he";
import { AppNav } from "@/components/layout/app-nav";

/**
 * Desktop sidebar (right side in RTL). Brand at the top, primary navigation in
 * the middle, and the signed-in identity at the bottom. Hidden on mobile, where
 * navigation moves to a horizontal strip under the header.
 */
export function Sidebar({
  userName,
  businessName,
}: {
  userName: string | null;
  businessName: string | null;
}) {
  return (
    <aside className="border-border bg-surface hidden w-64 shrink-0 flex-col border-l md:flex">
      <div className="border-border flex h-16 items-center border-b px-6">
        <span className="text-foreground text-xl font-bold tracking-tight">
          {BRAND.name}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <AppNav variant="sidebar" />
      </div>

      <div className="border-border border-t px-6 py-4">
        {businessName && (
          <p className="text-foreground truncate text-sm font-medium">
            {businessName}
          </p>
        )}
        {userName && (
          <p className="text-muted truncate text-xs">{userName}</p>
        )}
      </div>
    </aside>
  );
}
