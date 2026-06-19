import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRING_BACK_HUB } from "@/lib/constants/he";

export type HubTab = "clients" | "slots" | "reviews" | "messages";
export type HubSubTab = "overview" | "retention" | "at-risk" | "campaigns";

const MAIN_TABS: { key: HubTab; label: string }[] = [
  { key: "clients", label: BRING_BACK_HUB.tabs.clients },
  { key: "slots", label: BRING_BACK_HUB.tabs.slots },
  { key: "reviews", label: BRING_BACK_HUB.tabs.reviews },
  { key: "messages", label: BRING_BACK_HUB.tabs.messages },
];

const SUB_TABS: { key: HubSubTab; label: string }[] = [
  { key: "overview", label: BRING_BACK_HUB.subTabs.overview },
  { key: "retention", label: BRING_BACK_HUB.subTabs.retention },
  { key: "at-risk", label: BRING_BACK_HUB.subTabs.atRisk },
  { key: "campaigns", label: BRING_BACK_HUB.subTabs.campaigns },
];

const ACTIVE_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(201,120,152,0.16) 0%, rgba(184,107,140,0.10) 100%)",
  color: "#b86b8c",
  boxShadow: "inset 0 0 0 1px rgba(184,107,140,0.22)",
};

/**
 * סרגל הכרטיסיות של מרכז "החזרת לקוחות" — כרטיסיות ראשיות, ותת-כרטיסיות
 * עבור הכרטיסייה "לקוחות שלא חזרו".
 */
export function BringBackTabs({
  activeTab,
  activeSub,
}: {
  activeTab: HubTab;
  activeSub: HubSubTab;
}) {
  return (
    <div className="space-y-2.5" dir="rtl">
      {/*
        Main tabs — on mobile the long Hebrew labels would wrap into an uneven
        multi-row block, so we use a single horizontally-scrollable row (hidden
        scrollbar) that stays swipeable. On desktop each tab grows to fill.
      */}
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {MAIN_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={`/bring-back?tab=${tab.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all duration-150 sm:flex-1",
                !active && "text-muted hover:text-foreground hover:bg-background-alt",
              )}
              style={active ? ACTIVE_STYLE : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Sub tabs — only for the "clients" tab; also a scrollable single row */}
      {activeTab === "clients" && (
        <div className="flex gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUB_TABS.map((sub) => {
            const active = sub.key === activeSub;
            return (
              <Link
                key={sub.key}
                href={`/bring-back?tab=clients&sub=${sub.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all duration-150",
                  !active && "text-muted hover:text-foreground hover:bg-background-alt",
                )}
                style={
                  active
                    ? {
                        background: "rgba(184,107,140,0.10)",
                        color: "#b86b8c",
                        boxShadow: "inset 0 0 0 1px rgba(184,107,140,0.22)",
                      }
                    : undefined
                }
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
