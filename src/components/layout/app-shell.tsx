import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ScrollReset } from "@/components/layout/scroll-reset";
import { AssistantWidget } from "@/components/assistant/assistant-widget";

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
    // h-dvh (ולא h-screen): בדפדפני מובייל שורת הכתובת נכנסת ויוצאת, ו-100vh
    // גדול מהאזור הנראה בפועל — כך תחתית האפליקציה הייתה נחתכת מתחת לסרגל הדפדפן.
    <div className="app-ambient flex h-dvh overflow-hidden">
      <Sidebar userName={userName} businessName={businessName} isAdmin={isAdmin} />

      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <ScrollReset containerId="main-scroll" />
        {/* Mobile-only header with hamburger; desktop nav is in Sidebar */}
        <Header businessName={businessName} isAdmin={isAdmin} />

        {/* ריווח תחתון גדול יותר מהריווח העליון — כדי שכפתור העוזר הצף
            (פינה תחתונה) לא יסתיר את השורה האחרונה בסוף הגלילה. */}
        <main className="flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-24 md:pt-9 lg:px-10 lg:pt-10 xl:px-14">
          {children}
        </main>
      </div>

      {/* Floating AI assistant — part of the single Allura plan, so always on. */}
      <AssistantWidget />
    </div>
  );
}
