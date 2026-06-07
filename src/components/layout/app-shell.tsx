import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={userName} businessName={businessName} />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile-only header with hamburger; desktop nav is in Sidebar */}
        <Header businessName={businessName} />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
