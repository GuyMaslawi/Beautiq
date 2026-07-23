"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Gem, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckoutAction } from "@/server/subscription/actions";
import { PREMIUM_PLAN, PLATINUM_PLAN, type PlanId, type PlanInfo } from "@/lib/plans";
import { SUBSCRIPTION } from "@/lib/constants/he";

const ORDER: PlanInfo[] = [PREMIUM_PLAN, PLATINUM_PLAN];

/**
 * Owner-facing plan switcher. Lets the business owner move between Premium and
 * Platinum in either direction; the shared checkout action resets the recurring
 * price, so the monthly charge always follows the chosen plan. In dev / mock
 * (Grow not configured) the switch applies instantly; in production it opens
 * Grow's hosted page to re-authorize the direct debit at the new price.
 */
export function ChangePlanDialog({
  open,
  onOpenChange,
  currentPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanId;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);

  function handleSelect(target: PlanId) {
    if (target === currentPlan || isPending) return;
    setPendingPlan(target);
    startTransition(async () => {
      const result = await startSubscriptionCheckoutAction(target);
      if (!result.ok) {
        toast.error(result.error ?? SUBSCRIPTION.genericError);
        setPendingPlan(null);
        return;
      }
      // A Grow hosted page (external URL) — send the owner there to pay.
      if (result.redirectUrl && /^https?:\/\//.test(result.redirectUrl)) {
        window.location.href = result.redirectUrl;
        return;
      }
      // Instant (dev / mock) switch — the plan + billing are already updated.
      toast.success(
        target === "platinum"
          ? SUBSCRIPTION.changePlan.successToPlatinum
          : SUBSCRIPTION.changePlan.successToPremium,
      );
      setPendingPlan(null);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{SUBSCRIPTION.changePlan.title}</DialogTitle>
          <DialogDescription>{SUBSCRIPTION.changePlan.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {ORDER.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isPlatinum = plan.id === "platinum";
            const busy = isPending && pendingPlan === plan.id;
            const accent = isPlatinum ? "#c79a3e" : "#ac5c7f";

            return (
              <div
                key={plan.id}
                className="flex flex-col rounded-2xl border p-4"
                style={{
                  borderColor: isCurrent ? accent : "var(--border)",
                  background: isCurrent
                    ? isPlatinum
                      ? "rgba(212,168,83,0.07)"
                      : "rgba(172,92,127,0.05)"
                    : "var(--surface)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: isPlatinum ? "rgba(212,168,83,0.15)" : "rgba(172,92,127,0.12)",
                    }}
                  >
                    {isPlatinum ? (
                      <Gem className="h-4 w-4" style={{ color: accent }} />
                    ) : (
                      <Crown className="h-4 w-4" style={{ color: accent }} />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                      {plan.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      ₪{plan.price} {SUBSCRIPTION.changePlan.perMonth}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                  {plan.tagline}
                </p>

                <div className="mt-auto pt-4">
                  {isCurrent ? (
                    <span
                      className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                      style={{ background: "rgba(52,140,90,0.10)", color: "#2f7d54" }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {SUBSCRIPTION.changePlan.currentBadge}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={isPlatinum ? "primary" : "secondary"}
                      className="w-full"
                      disabled={isPending}
                      onClick={() => handleSelect(plan.id)}
                    >
                      {busy
                        ? SUBSCRIPTION.changePlan.switching
                        : isPlatinum
                          ? SUBSCRIPTION.changePlan.upgradeTo
                          : SUBSCRIPTION.changePlan.downgradeTo}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {SUBSCRIPTION.changePlan.note}
        </p>
      </DialogContent>
    </Dialog>
  );
}
