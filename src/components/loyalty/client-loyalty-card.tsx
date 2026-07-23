import { Gift, Star } from "lucide-react";
import { LOYALTY } from "@/lib/constants/he";
import type { ClientLoyaltyStatus } from "@/server/loyalty/queries";

/**
 * Loyalty progress for one client, shown on the client profile. Server component
 * (read-only). Renders nothing when the program is inactive or the client has no
 * completed visits (caller passes null in that case).
 */
export function ClientLoyaltyCard({ status }: { status: ClientLoyaltyStatus }) {
  const { visitsRequired, visitsInCurrentCard, pendingRewards, redeemedRewards, rewardDescription } = status;
  const eligible = pendingRewards > 0;
  const almost = !eligible && status.visitsToReward === 1;
  const dots = Math.min(visitsRequired, 12);

  return (
    <div
      className="rounded-[1.2rem] p-5"
      style={{
        background: eligible
          ? "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)"
          : "rgba(255,255,255,0.97)",
        border: "1px solid rgba(172,92,127,0.20)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(172,92,127,0.12)" }}>
          <Gift className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{LOYALTY.badge.cardTitle}</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {status.completedVisits} {LOYALTY.config.visitsSuffix}
          </p>
        </div>
        {eligible && (
          <span
            className="ms-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "rgba(172,92,127,0.14)", color: "var(--primary)" }}
          >
            {LOYALTY.badge.eligible}
          </span>
        )}
      </div>

      {/* Progress dots */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: i < visitsInCurrentCard ? "var(--primary)" : "rgba(172,92,127,0.18)" }}
          />
        ))}
      </div>

      <p className="text-sm font-medium" style={{ color: eligible || almost ? "var(--primary)" : "var(--foreground)" }}>
        {eligible ? LOYALTY.badge.eligible : LOYALTY.badge.cardVisits(visitsInCurrentCard, visitsRequired)}
      </p>

      <div className="mt-2 space-y-0.5">
        {rewardDescription && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
            <Star className="h-3 w-3" style={{ color: "#c09560" }} />
            {LOYALTY.badge.cardReward(rewardDescription)}
          </p>
        )}
        {redeemedRewards > 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.badge.cardRewardsGiven(redeemedRewards)}</p>
        )}
      </div>
    </div>
  );
}
