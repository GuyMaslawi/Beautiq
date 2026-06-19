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
      {/* Main tabs */}
      <div
        className="flex flex-wrap gap-1 rounded-2xl p-1"
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
                "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all duration-150",
                !active && "text-muted hover:text-foreground hover:bg-background-alt",
              )}
              style={active ? ACTIVE_STYLE : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Sub tabs — only for the "clients" tab */}
      {activeTab === "clients" && (
        <div className="flex flex-wrap gap-1 px-1">
          {SUB_TABS.map((sub) => {
            const active = sub.key === activeSub;
            return (
              <Link
                key={sub.key}
                href={`/bring-back?tab=clients&sub=${sub.key}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150",
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
