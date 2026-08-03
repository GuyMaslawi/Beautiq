"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gem, CreditCard, CalendarClock, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelSubscriptionAction, startSubscriptionCheckoutAction } from "@/server/subscription/actions";
import { ALLURA_PLAN } from "@/lib/plans";
import { SUBSCRIPTION } from "@/lib/constants/he";
import { isTrialActive, trialDaysLeft } from "@/lib/subscription/trial";
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
 * Owner-facing subscription summary in Settings: the plan, monthly price, next
 * renewal (or end date once cancelled), and cancelling. There is a single plan,
 * so there is nothing to switch to. Cancelling keeps access until the paid
 * period ends.
 */
export function SubscriptionCard({ overview }: { overview: SubscriptionOverview }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // "עכשיו" נלכד פעם אחת בטעינה — קריאה לשעון בזמן render אינה דטרמיניסטית.
  const [nowMs] = useState(() => Date.now());

  const statusKey: StatusKey =
    overview.status ?? (overview.isManaged ? "active" : "active");
  const statusStyle = STATUS_STYLE[statusKey];

  const price =
    overview.priceMinor != null ? Math.round(overview.priceMinor / 100) : ALLURA_PLAN.price;
  const cancelled = overview.status === "cancelled";

  // תקופת ניסיון: גישה מלאה עם תאריך סיום ובלי חיוב. גובר על סטטוס שורת החיוב —
  // בעלת עסק בניסיון עשויה לגרור מאחוריה שורת מנוי ישנה, ואסור שהמסך יציג לה
  // "פעיל · ₪199 לחודש" כשלא מחויב ממנה דבר והגישה עומדת להיסגר.
  const trialEndsAt = overview.trialEndsAt;
  const onTrial = isTrialActive(trialEndsAt, nowMs);
  const daysLeft = trialEndsAt ? trialDaysLeft(trialEndsAt, nowMs) : 0;

  function handleReauth() {
    startTransition(async () => {
      const result = await startSubscriptionCheckoutAction();
      if (!result.ok) {
        toast.error(result.error ?? SUBSCRIPTION.genericError);
        return;
      }
      // Production: Grow's secure hosted page to re-authorize the direct debit.
      if (result.redirectUrl && /^https?:\/\//.test(result.redirectUrl)) {
        window.location.href = result.redirectUrl;
        return;
      }
      // Dev / mock: applied instantly.
      toast.success(SUBSCRIPTION.reauth.success);
      router.refresh();
    });
  }

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
              background: "rgba(172,92,127,0.12)",
              border: "1px solid rgba(172,92,127,0.24)",
            }}
          >
            <Gem className="h-4.5 w-4.5" style={{ color: "#ac5c7f" }} />
          </span>
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.currentPlan}</p>
            <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              {ALLURA_PLAN.name}
            </p>
          </div>
        </div>

        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={
            onTrial
              ? {
                  background: "rgba(146,96,159,0.12)",
                  color: "#92609f",
                  border: "1px solid rgba(146,96,159,0.30)",
                }
              : { background: statusStyle.bg, color: statusStyle.fg, border: `1px solid ${statusStyle.border}` }
          }
        >
          {onTrial ? SUBSCRIPTION.trial.badge : SUBSCRIPTION.status[statusKey]}
        </span>
      </div>

      {/* Details */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-muted, rgba(172,92,127,0.05))", border: "1px solid var(--border)" }}>
          <CreditCard className="h-4 w-4 shrink-0" style={{ color: "#ac5c7f" }} />
          <div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.monthlyPrice}</p>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {onTrial ? (
                <>
                  {SUBSCRIPTION.trial.priceLabel}{" "}
                  <span className="font-normal" style={{ color: "var(--muted)" }}>
                    · {SUBSCRIPTION.trial.priceHint}
                  </span>
                </>
              ) : (
                <>
                  ₪{price} <span className="font-normal" style={{ color: "var(--muted)" }}>/ {SUBSCRIPTION.perMonth}</span>
                  {overview.cardSuffix ? (
                    <span className="font-normal" style={{ color: "var(--muted)" }}> · {SUBSCRIPTION.card} •••• {overview.cardSuffix}</span>
                  ) : null}
                </>
              )}
            </p>
          </div>
        </div>

        {onTrial && trialEndsAt ? (
          <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "var(--surface-muted, rgba(172,92,127,0.05))", border: "1px solid var(--border)" }}>
            <CalendarClock className="h-4 w-4 shrink-0" style={{ color: "#92609f" }} />
            <div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {SUBSCRIPTION.trial.endsOn.replace("־", "")}
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {formatDate(trialEndsAt)}{" "}
                <span className="font-normal" style={{ color: "var(--muted)" }}>
                  · {SUBSCRIPTION.trial.daysLeft(daysLeft)}
                </span>
              </p>
            </div>
          </div>
        ) : overview.currentPeriodEnd && (
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
      {onTrial ? (
        // בתקופת ניסיון אין מה לבטל ואין מה לחדש — יש רק דרך אחת קדימה: להפעיל
        // את המנוי. הכפתור חייב להופיע כאן, אחרת בעלת עסק שרוצה להמשיך פשוט
        // אין לה איפה לשלם עד שהגישה נסגרת מעצמה.
        <div
          className="flex flex-col gap-3 rounded-xl px-3.5 py-3.5"
          style={{ background: "rgba(146,96,159,0.07)", border: "1px solid rgba(146,96,159,0.26)" }}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#92609f" }} />
            <div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{SUBSCRIPTION.trial.note}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {SUBSCRIPTION.trial.activateHint(price)}
              </p>
            </div>
          </div>
          <div>
            <Button size="sm" variant="primary" onClick={handleReauth} disabled={isPending}>
              <CreditCard className="h-4 w-4" />
              {isPending ? SUBSCRIPTION.trial.activating : SUBSCRIPTION.trial.activateButton}
            </Button>
          </div>
        </div>
      ) : overview.needsReauth ? (
        <div
          className="flex flex-col gap-3 rounded-xl px-3.5 py-3.5"
          style={{ background: "rgba(172,92,127,0.07)", border: "1px solid rgba(172,92,127,0.28)" }}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#ac5c7f" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {SUBSCRIPTION.reauth.title}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                כדי להפעיל את החיוב החודשי (₪{price} {SUBSCRIPTION.perMonth}) יש לאשר מחדש את אמצעי התשלום בעמוד המאובטח.
              </p>
            </div>
          </div>
          <div>
            <Button size="sm" variant="primary" onClick={handleReauth} disabled={isPending}>
              <CreditCard className="h-4 w-4" />
              {isPending ? SUBSCRIPTION.reauth.submitting : SUBSCRIPTION.reauth.button}
            </Button>
          </div>
        </div>
      ) : overview.isManaged ? (
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
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
