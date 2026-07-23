"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Sparkles, Users, Award, Check, RotateCcw, MessageCircle, Star, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { LOYALTY } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { renderLoyaltyMessage } from "@/lib/loyalty/messages";
import { LOYALTY_MESSAGE_VARIABLES } from "@/lib/loyalty/constants";
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
  const [autoSend, setAutoSend] = useState(config.autoSendEnabled);
  const [almostMsg, setAlmostMsg] = useState(config.almostThereMessage);
  const [rewardMsg, setRewardMsg] = useState(config.rewardMessage);

  const previewVars = {
    clientName: "מיכל",
    businessName: "העסק שלך",
    reward: reward || "הטבה",
    completedVisits: Math.max(1, (Number(visits) || 10) - 1),
  };

  return (
    <form action={formAction} className="aura-card rounded-[1.4rem] p-5" noValidate>
      <div className="mb-2.5 flex items-center gap-2.5">
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
      <p className="mb-4 text-xs leading-5" style={{ color: "var(--muted)" }}>{LOYALTY.config.intro}</p>

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

      {/* ── Automatic messages ─────────────────────────────────────────── */}
      <div className="mb-5 mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h4 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {LOYALTY.messages.title}
          </h4>
        </div>
        <p className="mb-4 text-xs leading-4" style={{ color: "var(--muted)" }}>{LOYALTY.messages.subtitle}</p>

        {/* Auto-send toggle */}
        <div className="mb-3 flex items-start justify-between gap-4 rounded-xl p-3.5" style={{ background: "rgba(172,92,127,0.05)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{LOYALTY.messages.autoSendLabel}</p>
            <p className="mt-0.5 text-xs leading-4" style={{ color: "var(--muted)" }}>{LOYALTY.messages.autoSendHint}</p>
          </div>
          <input type="hidden" name="autoSendEnabled" value={autoSend ? "on" : "off"} />
          <Switch checked={autoSend} onCheckedChange={setAutoSend} aria-label={LOYALTY.messages.autoSendLabel} />
        </div>

        {/* Almost-there message */}
        <MessageField
          icon={Bell}
          title={LOYALTY.messages.almostThereTitle}
          desc={LOYALTY.messages.almostThereDesc}
          name="almostThereMessage"
          value={almostMsg}
          onChange={setAlmostMsg}
          preview={renderLoyaltyMessage(almostMsg, previewVars)}
          error={state.errors?.almostThereMessage}
        />

        {/* Reward-earned message */}
        <MessageField
          icon={Gift}
          title={LOYALTY.messages.rewardTitle}
          desc={LOYALTY.messages.rewardDesc}
          name="rewardMessage"
          value={rewardMsg}
          onChange={setRewardMsg}
          preview={renderLoyaltyMessage(rewardMsg, { ...previewVars, completedVisits: Number(visits) || 10 })}
          error={state.errors?.rewardMessage}
        />

        {autoSend && (
          <p className="mt-1 rounded-xl px-3.5 py-2.5 text-xs leading-5" style={{ background: "rgba(184,124,30,0.08)", color: "#7a6400" }}>
            {LOYALTY.messages.autoNote}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? LOYALTY.config.saving : LOYALTY.config.save}
      </Button>
    </form>
  );
}

/* ── Editable auto-message field (label + textarea + variables + preview) ──── */
function MessageField({
  icon: Icon,
  title,
  desc,
  name,
  value,
  onChange,
  preview,
  error,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  preview: string;
  error?: string;
}) {
  return (
    <div className="mb-4 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid var(--border)" }}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</span>
      </div>
      <p className="mb-2 text-xs leading-4" style={{ color: "var(--muted)" }}>{desc}</p>
      <Textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={500}
        className="text-sm"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>{LOYALTY.messages.variablesTitle}</span>
        {LOYALTY_MESSAGE_VARIABLES.map((v) => (
          <span
            key={v}
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(172,92,127,0.10)", color: "var(--primary)" }}
          >
            {v}
          </span>
        ))}
      </div>
      {preview.trim() && (
        <div className="mt-2 rounded-lg px-3 py-2" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)" }}>
          <p className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>{LOYALTY.messages.previewTitle}</p>
          <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--foreground)" }}>{preview}</p>
        </div>
      )}
      {error && <p className="mt-1 text-xs" style={{ color: "#be4a4a" }}>{error}</p>}
    </div>
  );
}

/* ── How it works ────────────────────────────────────────────────────────── */
function HowItWorks() {
  return (
    <div
      className="rounded-[1.4rem] p-5"
      style={{
        background: "linear-gradient(135deg, #fdf0f7 0%, #f9f2e6 100%)",
        border: "1px solid rgba(172,92,127,0.16)",
      }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(172,92,127,0.14)" }}>
          <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
            {LOYALTY.how.title}
          </h2>
          <p className="mt-0.5 text-xs leading-4" style={{ color: "var(--muted)" }}>{LOYALTY.how.intro}</p>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-3">
        {LOYALTY.how.steps.map((step, i) => (
          <li
            key={step.title}
            className="rounded-2xl p-3.5"
            style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(172,92,127,0.12)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: "rgba(172,92,127,0.14)", color: "var(--primary)" }}
              >
                {i + 1}
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{step.title}</span>
            </div>
            <p className="text-xs leading-5" style={{ color: "var(--muted)" }}>{step.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs font-medium leading-5" style={{ color: "var(--primary)" }}>{LOYALTY.how.why}</p>
    </div>
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
  const { config, eligibleClients, closeClients, members, totalRewardsGiven, totalMembers } = overview;
  const reward = config.rewardDescription;

  return (
    <div className="space-y-5">
      {/* Plain-language explainer — what this is, how it runs, why it pays off */}
      <HowItWorks />

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

        {/* All members — visit counts + progress for every client */}
        <div className="aura-card overflow-hidden rounded-[1.4rem]">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="font-display text-base font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>
              {LOYALTY.members.title}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{LOYALTY.members.subtitle}</p>
          </div>
          {members.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{LOYALTY.members.empty}</p>
          ) : (
            <ul>
              {members.map((c) => (
                <MemberRow key={c.clientId} client={c} visitsRequired={config.visitsRequired} />
              ))}
            </ul>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ── Member row (all-members list) ───────────────────────────────────────── */
function MemberRow({ client, visitsRequired }: { client: LoyaltyClientProgress; visitsRequired: number }) {
  const eligible = client.pendingRewards > 0;
  const almost = !eligible && visitsRequired - client.visitsInCurrentCard === 1;
  const tag = eligible ? LOYALTY.members.eligibleTag : almost ? LOYALTY.members.almostTag : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>{client.fullName}</span>
          {tag && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                eligible
                  ? { background: "rgba(172,92,127,0.14)", color: "var(--primary)" }
                  : { background: "rgba(184,124,30,0.12)", color: "#7a6400" }
              }
            >
              {tag}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          {LOYALTY.members.visits(client.completedVisits)}
          {client.redeemedRewards > 0 && <> · {LOYALTY.members.rewardsGiven(client.redeemedRewards)}</>}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <ProgressDots done={client.visitsInCurrentCard} total={visitsRequired} />
        <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
          {LOYALTY.members.progress(client.visitsInCurrentCard, visitsRequired)}
        </span>
      </div>
    </li>
  );
}
