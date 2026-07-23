"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Gem, Flower2, CreditCard, CalendarClock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChangePlanDialog } from "@/components/settings/change-plan-dialog";
import { cancelSubscriptionAction } from "@/server/subscription/actions";
import { PLANS, type PlanId } from "@/lib/plans";
import { SUBSCRIPTION } from "@/lib/constants/he";
import type { SubscriptionOverview } from "@/server/subscription/queries";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type StatusKey = keyof typeof SUBSCRIPTION.status;

const STATUS_STYLE: Record<StatusKey, { bg: string; fg: string; border: string }> = {
  active: { bg: "rgba(52,140,90,0.12)", fg: "#2f7d54", border: "rgba(52,140,90,0.30)" },
  past_due: { bg: "rgba(198,124,58,0.14)", fg: "#b06a24", border: "rgba(198,124,58,0.32)" },
  cancelled: { bg: "rgba(120,120,130,0.14)", fg: "#6b6b76", border: "rgba(120,120,130,0.30)" },
  expired: { bg: "rgba(190,74,74,0.12)", fg: "#b04a4a", border: "rgba(190,74,74,0.30)" },
  pending: { bg: "rgba(172,92,127,0.12)", fg: "#ac5c7f", border: "rgba(172,92,127,0.28)" },
};

/**
 * Owner-facing subscription summary in Settings: current plan, monthly price,
 * next renewal (or end date once cancelled), and actions (upgrade / cancel).
 * Cancelling keeps access until the paid period ends.
 */
export function SubscriptionCard({ overview }: { overview: SubscriptionOverview }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

  const planId = (overview.plan ?? "premium") as PlanId;
  const planInfo = PLANS[planId];
  const isPlatinum = planId === "platinum";

  const statusKey: StatusKey =
    overview.status ?? (overview.isManaged ? "active" : "active");
  const statusStyle = STATUS_STYLE[statusKey];

  const price = overview.priceMinor != null ? Math.round(overview.priceMinor / 100) : planInfo.price;
  const cancelled = overview.status === "cancelled";

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSubscriptionAction();
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.error ?? SUBSCRIPTION.genericError);
        return;
      }
      toast.success(SUBSCRIPTION.cancelSuccess);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: plan + status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: isPlatinum ? "rgba(212,168,83,0.15)" : "rgba(172,92,127,0.12)",
              border: isPlatinum ? "1px solid rgba(212,168,83,0.35)" : "1px solid rgba(172,92,127,0.24)",
            }}
          >
            {isPlatinum ? (
              <Gem className="h-4.5 w-4.5" style={{ color: "#c79a3e" }} />
            ) : (
              <Flower2 className="h-4.5 w-4.5" style={{ color: "#ac5c7f" }} />
            )}
          </span>
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.currentPlan}</p>
            <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              {planInfo.name}
            </p>
          </div>
        </div>

        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: statusStyle.bg, color: statusStyle.fg, border: `1px solid ${statusStyle.border}` }}
        >
          {SUBSCRIPTION.status[statusKey]}
        </span>
      </div>

      {/* Details */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-muted, rgba(172,92,127,0.05))", border: "1px solid var(--border)" }}>
          <CreditCard className="h-4 w-4 shrink-0" style={{ color: "#ac5c7f" }} />
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.monthlyPrice}</p>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              ₪{price} <span className="font-normal" style={{ color: "var(--muted)" }}>/ {SUBSCRIPTION.perMonth}</span>
              {overview.cardSuffix ? (
                <span className="font-normal" style={{ color: "var(--muted)" }}> · {SUBSCRIPTION.card} •••• {overview.cardSuffix}</span>
              ) : null}
            </p>
          </div>
        </div>

        {overview.currentPeriodEnd && (
          <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-muted, rgba(172,92,127,0.05))", border: "1px solid var(--border)" }}>
            <CalendarClock className="h-4 w-4 shrink-0" style={{ color: "#ac5c7f" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {cancelled ? SUBSCRIPTION.endsOn : SUBSCRIPTION.renewsOn}
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {formatDate(overview.currentPeriodEnd)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Past-due warning */}
      {overview.status === "past_due" && (
        <div className="flex items-start gap-2 rounded-xl px-3.5 py-3" style={{ background: "rgba(198,124,58,0.10)", border: "1px solid rgba(198,124,58,0.28)" }}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b06a24" }} />
          <p className="text-sm" style={{ color: "#8a5418" }}>{SUBSCRIPTION.pastDueNote}</p>
        </div>
      )}

      {/* Actions */}
      {overview.isManaged ? (
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {!cancelled && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setChangeOpen(true)}
              disabled={isPending}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {SUBSCRIPTION.changePlanButton}
            </Button>
          )}
          {!cancelled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              style={{ color: "var(--muted)" }}
            >
              {SUBSCRIPTION.cancelButton}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.adminNote}</p>
      )}

      <ChangePlanDialog open={changeOpen} onOpenChange={setChangeOpen} currentPlan={planId} />

      <ConfirmDialog
        open={confirmOpen}
        title={SUBSCRIPTION.cancelConfirm.title}
        description={SUBSCRIPTION.cancelConfirm.description}
        confirmLabel={isPending ? SUBSCRIPTION.cancelling : SUBSCRIPTION.cancelConfirm.confirm}
        cancelLabel={SUBSCRIPTION.cancelConfirm.cancel}
        destructive
        pending={isPending}
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
