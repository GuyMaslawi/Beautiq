"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Send, X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { WA_CAMPAIGNS } from "@/lib/constants/whatsapp-campaigns";
import {
  previewCampaignAudienceAction,
  listCampaignCandidatesAction,
  createCampaignAction,
  processCampaignBatchAction,
  getCampaignProgressAction,
  type CampaignPreviewResult,
  type CampaignCandidate,
  type CampaignProgressResult,
} from "@/server/whatsapp/campaigns/actions";
import type { AudienceInput } from "@/server/whatsapp/campaigns/eligibility";
import type { CampaignCounts } from "@/server/whatsapp/campaigns/processor";

type Step = "audience" | "content" | "confirm" | "progress";
type Mode = "all_eligible" | "manual";

const NOT_RETURNED_OPTIONS = [
  { label: "הכול", value: undefined },
  { label: "30 יום", value: 30 },
  { label: "60 יום", value: 60 },
  { label: "90 יום", value: 90 },
];

export function BulkCampaignDrawer() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("audience");
  const [mode, setMode] = useState<Mode>("all_eligible");
  const [notReturnedDays, setNotReturnedDays] = useState<number | undefined>(undefined);
  const [futureBooking, setFutureBooking] = useState<"any" | "with" | "without">("any");
  const [search, setSearch] = useState("");

  const [candidates, setCandidates] = useState<CampaignCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<CampaignPreviewResult | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [counts, setCounts] = useState<CampaignCounts | null>(null);
  const [progressDone, setProgressDone] = useState(false);

  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>("");
  const sendingRef = useRef(false);

  function reset() {
    setStep("audience");
    setMode("all_eligible");
    setNotReturnedDays(undefined);
    setFutureBooking("any");
    setSearch("");
    setCandidates([]);
    setSelected(new Set());
    setPreview(null);
    setConfirmChecked(false);
    setCounts(null);
    setProgressDone(false);
    setError("");
    sendingRef.current = false;
  }

  function handleOpen() {
    reset();
    idempotencyKey.current =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  const filters = useCallback((): AudienceInput["filters"] => {
    return {
      notReturnedDays,
      hasFutureBooking:
        futureBooking === "any" ? undefined : futureBooking === "with",
      search: search.trim() || undefined,
    };
  }, [notReturnedDays, futureBooking, search]);

  function buildInput(): AudienceInput {
    if (mode === "manual") {
      return { mode: "manual", clientIds: [...selected], filters: filters() };
    }
    return { mode: "all_eligible", filters: filters() };
  }

  function loadCandidates() {
    setError("");
    startTransition(async () => {
      const res = await listCampaignCandidatesAction(filters());
      if (!res.ok) {
        setError(WA_CAMPAIGNS.errors.generic);
        return;
      }
      setCandidates(res.candidates);
      // Pre-select all eligible candidates.
      setSelected(new Set(res.candidates.filter((c) => c.eligible).map((c) => c.clientId)));
    });
  }

  function goToContent() {
    setError("");
    startTransition(async () => {
      const res = await previewCampaignAudienceAction(buildInput());
      if (!res.ok) {
        setError(res.error ?? WA_CAMPAIGNS.errors.generic);
        return;
      }
      setPreview(res);
      setStep("content");
    });
  }

  function goToConfirm() {
    setStep("confirm");
  }

  const driveProgress = useCallback(
    async (id: string) => {
      // Owner-driven batching: keep asking the server to process one bounded batch
      // until the campaign is terminal. If another worker holds the lock (busy),
      // just poll read-only progress. Never sends the whole audience in one request.
      let guard = 0;
      let consecutiveErrors = 0;
      while (guard++ < 5000) {
        let res: CampaignProgressResult;
        try {
          res = await processCampaignBatchAction(id);
        } catch {
          res = { ok: false };
        }

        if (res.ok) {
          consecutiveErrors = 0;
          if (res.counts) setCounts(res.counts);
          if (res.done) {
            setProgressDone(true);
            return;
          }
        } else {
          // Don't spin silently on a persistent server/Meta failure — surface it
          // and stop after a few tries. The campaign is durable; the cron backstop
          // will finish any remaining recipients in the background.
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            setError(WA_CAMPAIGNS.errors.generic);
            return;
          }
        }

        if (res.busy) {
          // Another worker is sending — poll read-only until it finishes.
          await new Promise((r) => setTimeout(r, 2500));
          const poll = await getCampaignProgressAction(id);
          if (poll.ok && poll.counts) setCounts(poll.counts);
          if (poll.ok && poll.done) {
            setProgressDone(true);
            return;
          }
        } else {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      // Guard exhausted (a very large audience). Sync the final state read-only so
      // the UI reflects completion instead of spinning forever.
      const finalPoll = await getCampaignProgressAction(id);
      if (finalPoll.ok) {
        if (finalPoll.counts) setCounts(finalPoll.counts);
        if (finalPoll.done) setProgressDone(true);
      }
    },
    [],
  );

  function handleSend() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setError("");
    startTransition(async () => {
      const res = await createCampaignAction({
        audience: buildInput(),
        audienceSummary: buildSummary(mode, notReturnedDays, futureBooking),
        idempotencyKey: idempotencyKey.current,
      });
      if (!res.ok || !res.campaignId) {
        setError(res.error ?? WA_CAMPAIGNS.errors.generic);
        sendingRef.current = false;
        return;
      }
      setStep("progress");
      await driveProgress(res.campaignId);
    });
  }

  const eligibleCount = preview?.counts?.eligible ?? 0;
  const templateAvailable = preview?.template?.available ?? false;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "#16a34a" }}
      >
        <Send className="h-3.5 w-3.5" />
        {WA_CAMPAIGNS.bulkAction}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={handleClose} />
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" dir="rtl">
            <div
              className="relative flex w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl"
              style={{ background: "var(--surface, #fff)", maxHeight: "92dvh" }}
            >
              {/* Header */}
              <div
                className="flex shrink-0 items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-green-600" />
                  <h2 className="text-base font-bold" style={{ color: "var(--foreground, #1a1a2e)" }}>
                    {WA_CAMPAIGNS.bulkAction}
                  </h2>
                </div>
                <button type="button" onClick={handleClose} className="rounded-full p-1.5 hover:opacity-70" style={{ color: "var(--muted, #888)" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <StepBar step={step} />

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {error && (
                  <div className="rounded-xl px-4 py-3 text-xs leading-5" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c" }}>
                    {error}
                  </div>
                )}

                {/* ---- Audience ---- */}
                {step === "audience" && (
                  <>
                    <RadioCard checked={mode === "all_eligible"} onClick={() => setMode("all_eligible")} title={WA_CAMPAIGNS.audience.allEligible} />
                    <RadioCard checked={mode === "manual"} onClick={() => { setMode("manual"); if (candidates.length === 0) loadCandidates(); }} title={WA_CAMPAIGNS.audience.manual} />

                    {/* Filters */}
                    <div className="space-y-3 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--foreground-soft,#555)" }}>{WA_CAMPAIGNS.audience.filterNotReturned}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {NOT_RETURNED_OPTIONS.map((o) => (
                            <Chip key={String(o.value)} active={notReturnedDays === o.value} onClick={() => setNotReturnedDays(o.value)} label={o.label} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--foreground-soft,#555)" }}>תור עתידי</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Chip active={futureBooking === "any"} onClick={() => setFutureBooking("any")} label="הכול" />
                          <Chip active={futureBooking === "with"} onClick={() => setFutureBooking("with")} label={WA_CAMPAIGNS.audience.filterFutureBooking} />
                          <Chip active={futureBooking === "without"} onClick={() => setFutureBooking("without")} label={WA_CAMPAIGNS.audience.filterNoFutureBooking} />
                        </div>
                      </div>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={WA_CAMPAIGNS.audience.searchPlaceholder}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "rgba(0,0,0,0.12)" }}
                      />
                      {mode === "manual" && (
                        <button type="button" onClick={loadCandidates} disabled={isPending} className="text-xs font-semibold text-green-700 disabled:opacity-50">
                          רענון רשימה
                        </button>
                      )}
                    </div>

                    {/* Manual candidate list */}
                    {mode === "manual" && (
                      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl p-2" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                        {candidates.length === 0 && (
                          <p className="p-3 text-center text-xs" style={{ color: "var(--muted,#888)" }}>{isPending ? "טוען…" : "אין לקוחות מתאימים"}</p>
                        )}
                        {candidates.map((c) => (
                          <label
                            key={c.clientId}
                            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm"
                            style={{ background: c.eligible ? "transparent" : "rgba(0,0,0,0.02)", opacity: c.eligible ? 1 : 0.6 }}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!c.eligible}
                                checked={selected.has(c.clientId)}
                                onChange={(e) => {
                                  const next = new Set(selected);
                                  if (e.target.checked) next.add(c.clientId);
                                  else next.delete(c.clientId);
                                  setSelected(next);
                                }}
                                className="h-4 w-4"
                                style={{ accentColor: "#16a34a" }}
                              />
                              <div>
                                <span className="font-medium" style={{ color: "var(--foreground,#1a1a2e)" }}>{c.clientName}</span>
                                <span className="mr-2 text-xs" dir="ltr" style={{ color: "var(--muted,#888)" }}>{c.maskedPhone}</span>
                              </div>
                            </div>
                            {!c.eligible && <span className="text-[11px]" style={{ color: "#b45309" }}>{c.reason}</span>}
                          </label>
                        ))}
                      </div>
                    )}

                    <FooterButtons
                      onCancel={handleClose}
                      primaryLabel="המשך"
                      onPrimary={goToContent}
                      primaryDisabled={isPending || (mode === "manual" && selected.size === 0)}
                      pending={isPending}
                    />
                  </>
                )}

                {/* ---- Content ---- */}
                {step === "content" && preview && (
                  <>
                    <CountsRow counts={preview.counts} />
                    {preview.excluded && preview.excluded.length > 0 && (
                      <ExcludedList items={preview.excluded} />
                    )}

                    <div className="rounded-xl p-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: "var(--foreground-soft,#555)" }}>{WA_CAMPAIGNS.content.templateLabel}</span>
                        <TemplateStatusBadge status={preview.template?.status ?? "unknown"} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--foreground,#1a1a2e)" }}>{preview.template?.label}</p>
                    </div>

                    <div className="rounded-xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap" style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.18)", color: "var(--foreground-soft,#444)" }}>
                      <p className="mb-1 text-xs font-semibold text-green-700">{WA_CAMPAIGNS.content.previewTitle}</p>
                      {preview.template?.preview}
                    </div>

                    <p className="text-xs leading-5" style={{ color: "var(--muted,#888)" }}>{WA_CAMPAIGNS.content.neutralNote}</p>

                    {!templateAvailable && (
                      <div className="flex gap-2 rounded-xl px-4 py-3 text-xs leading-5" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#854d0e" }}>
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {WA_CAMPAIGNS.content.unavailableWarning}
                      </div>
                    )}

                    <FooterButtons
                      onCancel={() => setStep("audience")}
                      cancelLabel="חזרה"
                      primaryLabel="המשך"
                      onPrimary={goToConfirm}
                      primaryDisabled={!templateAvailable || eligibleCount === 0}
                    />
                  </>
                )}

                {/* ---- Confirm ---- */}
                {step === "confirm" && preview && (
                  <>
                    <div className="space-y-2 rounded-xl p-4" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <SummaryRow label={WA_CAMPAIGNS.confirm.template} value={preview.template?.label ?? ""} />
                      <SummaryRow label={WA_CAMPAIGNS.confirm.eligible} value={String(eligibleCount)} />
                      <SummaryRow label={WA_CAMPAIGNS.confirm.excluded} value={String(preview.counts?.excluded ?? 0)} />
                      <SummaryRow label={WA_CAMPAIGNS.confirm.estimated} value={String(eligibleCount)} />
                    </div>

                    <div className="flex gap-2 rounded-xl px-4 py-3 text-xs leading-5" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#854d0e" }}>
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {WA_CAMPAIGNS.confirm.warning}
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5 text-sm" style={{ color: "var(--foreground,#1a1a2e)" }}>
                      <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: "#16a34a" }} />
                      <span>{WA_CAMPAIGNS.confirm.checkbox(eligibleCount)}</span>
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button type="button" onClick={() => setStep("content")} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: "var(--muted,#888)", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
                        חזרה
                      </button>
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={!confirmChecked || isPending || eligibleCount === 0}
                        className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: "#16a34a" }}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isPending ? WA_CAMPAIGNS.confirm.sending : WA_CAMPAIGNS.confirm.sendButton(eligibleCount)}
                      </button>
                    </div>
                  </>
                )}

                {/* ---- Progress ---- */}
                {step === "progress" && (
                  <>
                    <div className="flex flex-col items-center gap-2 py-2 text-center">
                      {progressDone ? (
                        <CheckCircle className="h-10 w-10 text-green-500" />
                      ) : (
                        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
                      )}
                      <p className="text-base font-bold" style={{ color: "var(--foreground,#1a1a2e)" }}>
                        {progressDone ? WA_CAMPAIGNS.progress.done : WA_CAMPAIGNS.progress.inProgress}
                      </p>
                    </div>

                    {counts && <ProgressCounts counts={counts} />}

                    <div className="flex justify-center pt-2">
                      <button type="button" onClick={handleClose} className="rounded-lg px-6 py-2 text-sm font-semibold text-white" style={{ background: progressDone ? "#16a34a" : "rgba(0,0,0,0.15)" }}>
                        {progressDone ? "סגירה" : "סגירה (השליחה תמשיך ברקע)"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function buildSummary(mode: Mode, notReturnedDays: number | undefined, futureBooking: string): string {
  const parts: string[] = [
    mode === "manual" ? WA_CAMPAIGNS.audience.manual : WA_CAMPAIGNS.audience.allEligible,
  ];
  if (notReturnedDays) parts.push(`לא חזרו ${notReturnedDays} יום`);
  if (futureBooking === "with") parts.push("עם תור עתידי");
  if (futureBooking === "without") parts.push("ללא תור עתידי");
  return parts.join(" · ");
}

// --- small presentational helpers ---

function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ["audience", "content", "confirm", "progress"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex gap-1 px-5 pt-3">
      {steps.map((s, i) => (
        <div key={s} className="h-1 flex-1 rounded-full" style={{ background: i <= idx ? "#16a34a" : "rgba(0,0,0,0.1)" }} />
      ))}
    </div>
  );
}

function RadioCard({ checked, onClick, title }: { checked: boolean; onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-right" style={{ borderColor: checked ? "#16a34a" : "rgba(0,0,0,0.1)", background: checked ? "rgba(22,163,74,0.04)" : "transparent" }}>
      <span className="grid h-4 w-4 place-items-center rounded-full border" style={{ borderColor: checked ? "#16a34a" : "rgba(0,0,0,0.3)" }}>
        {checked && <span className="h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />}
      </span>
      <span className="text-sm font-medium" style={{ color: "var(--foreground,#1a1a2e)" }}>{title}</span>
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: active ? "#16a34a" : "rgba(0,0,0,0.05)", color: active ? "#fff" : "var(--foreground-soft,#555)" }}>
      {label}
    </button>
  );
}

function CountsRow({ counts }: { counts?: { totalSelected: number; eligible: number; excluded: number } }) {
  if (!counts) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatBox label={WA_CAMPAIGNS.audience.eligibleCount} value={counts.eligible} tone="green" />
      <StatBox label={WA_CAMPAIGNS.audience.excludedCount} value={counts.excluded} tone="amber" />
      <StatBox label={WA_CAMPAIGNS.audience.selectedCount} value={counts.totalSelected} tone="neutral" />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "neutral" }) {
  const color = tone === "green" ? "#15803d" : tone === "amber" ? "#b45309" : "var(--foreground,#1a1a2e)";
  const bg = tone === "green" ? "rgba(22,163,74,0.06)" : tone === "amber" ? "rgba(234,179,8,0.08)" : "rgba(0,0,0,0.03)";
  return (
    <div className="rounded-xl px-3 py-2.5 text-center" style={{ background: bg }}>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px]" style={{ color: "var(--muted,#888)" }}>{label}</p>
    </div>
  );
}

function ExcludedList({ items }: { items: Array<{ clientName: string; maskedPhone: string; reason: string }> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-amber-700">
        {WA_CAMPAIGNS.audience.viewExcluded} ({items.length})
      </button>
      {expanded && (
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg p-2" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          {items.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <span style={{ color: "var(--foreground,#1a1a2e)" }}>{r.clientName}</span>
              <span style={{ color: "#b45309" }}>{r.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    approved: { label: "מאושרת", color: "#15803d", bg: "rgba(22,163,74,0.1)" },
    pending: { label: "ממתינה לאישור", color: "#b45309", bg: "rgba(234,179,8,0.12)" },
    rejected: { label: "נדחתה", color: "#b91c1c", bg: "rgba(220,38,38,0.1)" },
    unknown: { label: "לא ידוע", color: "#6b7280", bg: "rgba(0,0,0,0.05)" },
  };
  const s = map[status] ?? map.unknown;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>{s.label}</span>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--muted,#888)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "var(--foreground,#1a1a2e)" }}>{value}</span>
    </div>
  );
}

function ProgressCounts({ counts }: { counts: CampaignCounts }) {
  const rows: Array<[string, number]> = [
    [WA_CAMPAIGNS.progress.accepted, counts.accepted],
    [WA_CAMPAIGNS.progress.sent, counts.sent],
    [WA_CAMPAIGNS.progress.delivered, counts.delivered],
    [WA_CAMPAIGNS.progress.read, counts.read],
    [WA_CAMPAIGNS.progress.failed, counts.failed],
    [WA_CAMPAIGNS.progress.skipped, counts.skipped],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg px-2 py-2 text-center" style={{ background: "rgba(0,0,0,0.03)" }}>
          <p className="text-base font-bold" style={{ color: "var(--foreground,#1a1a2e)" }}>{value}</p>
          <p className="text-[11px]" style={{ color: "var(--muted,#888)" }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

function FooterButtons({
  onCancel,
  cancelLabel = "ביטול",
  primaryLabel,
  onPrimary,
  primaryDisabled,
  pending,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: "var(--muted,#888)", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
        {cancelLabel}
      </button>
      <button type="button" onClick={onPrimary} disabled={primaryDisabled} className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: "#16a34a" }}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {primaryLabel}
      </button>
    </div>
  );
}
