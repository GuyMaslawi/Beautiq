import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ScrollReset } from "@/components/layout/scroll-reset";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

export function AppShell({
  userName,
  businessName,
  isAdmin = false,
  hasPlatinum = false,
  assistantEnabled = false,
  children,
}: {
  userName: string | null;
  businessName: string | null;
  isAdmin?: boolean;
  /** When false, Platinum-only nav items are hidden (Premium users). */
  hasPlatinum?: boolean;
  /** Show the floating AI assistant chat launcher (platinum/admin only). */
  assistantEnabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="app-ambient flex h-screen overflow-hidden">
      <Sidebar userName={userName} businessName={businessName} isAdmin={isAdmin} hasPlatinum={hasPlatinum} />

      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <ScrollReset containerId="main-scroll" />
        {/* Mobile-only header with hamburger; desktop nav is in Sidebar */}
        <Header businessName={businessName} isAdmin={isAdmin} hasPlatinum={hasPlatinum} />

        <main className="flex-1 px-4 py-6 md:px-8 md:py-9 lg:px-10 lg:py-10 xl:px-14">
          {children}
        </main>
      </div>

      {/* Floating AI assistant — platinum/admin only (gated at the layout). */}
      {assistantEnabled && <AssistantWidget />}
    </div>
  );
}
