import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ScrollReset } from "@/components/layout/scroll-reset";

export function AppShell({
  userName,
  businessName,
  isAdmin = false,
  children,
}: {
  userName: string | null;
  businessName: string | null;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="app-ambient flex h-screen overflow-hidden">
      <Sidebar userName={userName} businessName={businessName} isAdmin={isAdmin} />

      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <ScrollReset containerId="main-scroll" />
        {/* Mobile-only header with hamburger; desktop nav is in Sidebar */}
        <Header businessName={businessName} isAdmin={isAdmin} />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-9 lg:px-10 lg:py-10 xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
