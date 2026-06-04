import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AppNav } from "@/components/layout/app-nav";

/**
 * The authenticated app shell — the frame every signed-in page sits in so the
 * product feels complete from the first screen. RTL-first: the sidebar lives on
 * the right (first flex child), with a horizontal nav strip on mobile.
 */
export function AppShell({
  userName,
  businessName,
  children,
}: {
  userName: string | null;
  businessName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar userName={userName} businessName={businessName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header businessName={businessName} />

        {/* ניווט למובייל — רצועה אופקית מתחת לכותרת */}
        <div className="border-border bg-surface border-b px-4 py-2 md:hidden">
          <AppNav variant="mobile" />
        </div>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
