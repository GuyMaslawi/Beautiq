"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Sparkles, Users, Award, Check, RotateCcw, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { LOYALTY } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  saveLoyaltyProgramAction,
  redeemLoyaltyRewardAction,
  undoLoyaltyRedemptionAction,
  type LoyaltyFormState,
} from "@/server/loyalty/actions";
import type { LoyaltyOverview, LoyaltyClientProgress } from "@/server/loyalty/queries";

const INITIAL: LoyaltyFormState = {};

/* ── Config form ─────────────────────────────────────────────────────────── */
function ConfigForm({ config }: { config: LoyaltyOverview["config"] }) {
  const [state, formAction, isPending] = useActionState(saveLoyaltyProgramAction, INITIAL);
  const [isActive, setIsActive] = useState(config.isActive);
  const [visits, setVisits] = useState(String(config.visitsRequired));
  const [reward, setReward] = useState(config.rewardDescription);

  return (
    <form action={formAction} className="aura-card rounded-[1.4rem] p-5" noValidate>
      <div className="mb-4 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: "rgba(172,92,127,0.12)" }}
        >
          <Gift className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </span>
        <h3 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
          {LOYALTY.config.title}
        </h3>
      </div>

      {state.formError && <Alert className="mb-4">{state.formError}</Alert>}
      {state.success && (
        <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{state.success}</div>
      )}

      {/* Active toggle */}
      <div className="mb-5 flex items-start justify-between gap-4 rounded-xl p-3.5" style={{ background: "rgba(172,92,127,0.05)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{LOYALTY.config.activeLabel}</p>
          <p className="mt-0.5 text-xs leading-4" style={{ color: "var(--muted)" }}>{LOYALTY.config.activeHint}</p>
        </div>
        <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
        <Switch checked={isActive} onCheckedChange={setIsActive} aria-label={LOYALTY.config.activeLabel} />
      </div>

      {/* Visits required */}
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {LOYALTY.config.visitsLabel}
        </label>
        <Input
          name="visitsRequired"
          type="number"
          inputMode="numeric"
          min={2}
          max={50}
          value={visits}
          onChange={(e) => setVisits(e.target.value)}
          className="max-w-[140px]"
        />
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.config.visitsHint}</p>
        {state.errors?.visitsRequired && (
          <p className="mt-1 text-xs" style={{ color: "#be4a4a" }}>{state.errors.visitsRequired}</p>
        )}
      </div>

      {/* Reward description */}
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {LOYALTY.config.rewardLabel}
        </label>
        <Input
          name="rewardDescription"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          placeholder={LOYALTY.config.rewardPlaceholder}
          maxLength={120}
        />
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.config.rewardHint}</p>
        {state.errors?.rewardDescription && (
          <p className="mt-1 text-xs" style={{ color: "#be4a4a" }}>{state.errors.rewardDescription}</p>
        )}
      </div>

      {/* Live preview */}
      <div
        className="mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3"
        style={{ background: "linear-gradient(135deg, #fdf0f7 0%, #f7f0dc 100%)", border: "1px solid rgba(172,92,127,0.18)" }}
      >
        <Star className="h-4 w-4 shrink-0" style={{ color: "#c09560" }} />
        <div>
          <p className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{LOYALTY.config.previewTitle}</p>
          <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
            {LOYALTY.config.preview(Number(visits) || 0, reward)}
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? LOYALTY.config.saving : LOYALTY.config.save}
      </Button>
    </form>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: number; icon: React.ElementType; highlight?: boolean }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-4"
      style={
        highlight
          ? { background: "linear-gradient(135deg, #fdf0f7 0%, #f5e8f2 100%)", border: "1px solid rgba(172,92,127,0.22)" }
          : { background: "rgba(255,255,255,0.97)", border: "1px solid var(--border)" }
      }
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: highlight ? "rgba(172,92,127,0.14)" : "rgba(43,37,48,0.06)" }}>
        <Icon className="h-4 w-4" style={{ color: highlight ? "var(--primary)" : "#8a8190" }} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: highlight ? "var(--primary)" : "var(--foreground)" }}>{value}</p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</p>
      </div>
    </div>
  );
}

/* ── Eligible client row ─────────────────────────────────────────────────── */
function EligibleRow({
  client,
  businessName,
  reward,
  onRefresh,
}: {
  client: LoyaltyClientProgress;
  businessName: string;
  reward: string;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const waUrl = buildWhatsAppUrl(client.phone, LOYALTY.message(client.fullName, businessName, reward));

  const redeem = () =>
    startTransition(async () => {
      setError(null);
      const res = await redeemLoyaltyRewardAction(client.clientId);
      if (res.error) setError(res.error);
      else onRefresh();
    });

  const undo = () =>
    startTransition(async () => {
      setError(null);
      const res = await undoLoyaltyRedemptionAction(client.clientId);
      if (res.error) setError(res.error);
      else onRefresh();
    });

  return (
    <li className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{client.fullName}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "rgba(172,92,127,0.12)", color: "var(--primary)" }}
            >
              {LOYALTY.eligible.pendingBadge(client.pendingRewards)}
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.eligible.visitsDone(client.completedVisits)}</p>
        </div>

        <div className="flex items-center gap-2">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: "rgba(37,211,102,0.10)", color: "#128c3e", border: "1px solid rgba(37,211,102,0.25)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {LOYALTY.eligible.sendMessage}
            </a>
          ) : (
            <span className="text-[11px]" style={{ color: "var(--muted-light)" }}>{LOYALTY.eligible.noPhone}</span>
          )}
          <Button type="button" onClick={redeem} disabled={pending} size="sm" className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {pending ? LOYALTY.eligible.marking : LOYALTY.eligible.markGiven}
          </Button>
        </div>
      </div>

      {client.redeemedRewards > 0 && (
        <button
          type="button"
          onClick={undo}
          disabled={pending}
          className="mt-2 flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "var(--muted)" }}
        >
          <RotateCcw className="h-3 w-3" />
          {LOYALTY.eligible.undo}
        </button>
      )}
      {error && <p className="mt-1.5 text-xs" style={{ color: "#be4a4a" }}>{error}</p>}
    </li>
  );
}

/* ── Progress dots ───────────────────────────────────────────────────────── */
function ProgressDots({ done, total }: { done: number; total: number }) {
  const capped = Math.min(total, 12);
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: capped }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: i < done ? "var(--primary)" : "rgba(172,92,127,0.18)" }}
        />
      ))}
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */
export function LoyaltyClient({ overview, businessName }: { overview: LoyaltyOverview; businessName: string }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const { config, eligibleClients, closeClients, totalRewardsGiven, totalMembers } = overview;
  const reward = config.rewardDescription;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
      {/* Left: config */}
      <ConfigForm config={config} />

      {/* Right: stats + lists */}
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={LOYALTY.stats.eligible} value={eligibleClients.length} icon={Sparkles} highlight />
          <StatCard label={LOYALTY.stats.close} value={closeClients.length} icon={Award} />
          <StatCard label={LOYALTY.stats.members} value={totalMembers} icon={Users} />
          <StatCard label={LOYALTY.stats.rewardsGiven} value={totalRewardsGiven} icon={Gift} />
        </div>

        {/* Eligible */}
        <div className="aura-card overflow-hidden rounded-[1.4rem]">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
              {LOYALTY.eligible.title}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.eligible.subtitle}</p>
          </div>
          {eligibleClients.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{LOYALTY.eligible.empty}</p>
          ) : (
            <ul>
              {eligibleClients.map((c) => (
                <EligibleRow key={c.clientId} client={c} businessName={businessName} reward={reward} onRefresh={refresh} />
              ))}
            </ul>
          )}
        </div>

        {/* Close to reward */}
        <div className="aura-card overflow-hidden rounded-[1.4rem]">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
              {LOYALTY.close.title}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.close.subtitle}</p>
          </div>
          {closeClients.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{LOYALTY.close.empty}</p>
          ) : (
            <ul>
              {closeClients.map((c) => (
                <li key={c.clientId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <span className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{c.fullName}</span>
                    <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--primary)" }}>
                      {LOYALTY.close.remaining(config.visitsRequired - c.visitsInCurrentCard)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressDots done={c.visitsInCurrentCard} total={config.visitsRequired} />
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {LOYALTY.close.progress(c.visitsInCurrentCard, config.visitsRequired)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
