"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, RotateCw, Ban } from "lucide-react";
import { WA_CAMPAIGNS } from "@/lib/constants/whatsapp-campaigns";
import {
  getCampaignDetailAction,
  retryCampaignFailedAction,
  cancelCampaignAction,
} from "@/server/whatsapp/campaigns/actions";
import type { CampaignListItem, CampaignDetail } from "@/server/whatsapp/campaigns/queries";

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  draft: { color: "#6b7280", bg: "rgba(0,0,0,0.05)" },
  queued: { color: "#b45309", bg: "rgba(234,179,8,0.12)" },
  processing: { color: "#1d4ed8", bg: "rgba(37,99,235,0.1)" },
  completed: { color: "#15803d", bg: "rgba(22,163,74,0.1)" },
  completed_with_errors: { color: "#b45309", bg: "rgba(234,179,8,0.12)" },
  cancelled: { color: "#6b7280", bg: "rgba(0,0,0,0.05)" },
};

function statusLabel(status: string): string {
  return (WA_CAMPAIGNS.status as Record<string, string>)[status] ?? status;
}

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function CampaignHistory({ campaigns }: { campaigns: CampaignListItem[] }) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDetail(id: string) {
    setLoadingId(id);
    startTransition(async () => {
      const res = await getCampaignDetailAction(id);
      setLoadingId(null);
      if (res.ok && res.detail) setDetail(res.detail);
    });
  }

  function refreshDetail(id: string) {
    startTransition(async () => {
      const res = await getCampaignDetailAction(id);
      if (res.ok && res.detail) setDetail(res.detail);
    });
  }

  function handleRetry(id: string) {
    startTransition(async () => {
      await retryCampaignFailedAction(id);
      refreshDetail(id);
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      await cancelCampaignAction(id);
      refreshDetail(id);
    });
  }

  if (campaigns.length === 0) return null;

  return (
    <div className="aura-card rounded-[1.4rem] p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-bold" style={{ color: "var(--foreground)" }}>{WA_CAMPAIGNS.historyTitle}</h3>
      <div className="space-y-2">
        {campaigns.map((c) => {
          const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => openDetail(c.id)}
              disabled={loadingId === c.id}
              className="flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-right transition-colors hover:bg-black/[0.02] disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>{statusLabel(c.status)}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{fmtDate(c.createdAt)}</span>
                </div>
                <p className="mt-1 truncate text-sm" style={{ color: "var(--foreground-soft, #555)" }}>
                  {c.audienceSummary ?? WA_CAMPAIGNS.audience.allEligible}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {WA_CAMPAIGNS.progress.accepted}: {c.counts.accepted + c.counts.sent + c.counts.delivered + c.counts.read} · {WA_CAMPAIGNS.progress.delivered}: {c.counts.delivered + c.counts.read} · {WA_CAMPAIGNS.progress.failed}: {c.counts.failed} · {WA_CAMPAIGNS.progress.skipped}: {c.counts.skipped}
                </p>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} />
            </button>
          );
        })}
      </div>

      {detail && (
        <CampaignDetailDrawer
          detail={detail}
          onClose={() => setDetail(null)}
          onRetry={() => handleRetry(detail.id)}
          onCancel={() => handleCancel(detail.id)}
          onRefresh={() => refreshDetail(detail.id)}
          pending={isPending}
        />
      )}
    </div>
  );
}

const RECIPIENT_STYLE: Record<string, { color: string; bg: string }> = {
  queued: { color: "#6b7280", bg: "rgba(0,0,0,0.05)" },
  processing: { color: "#1d4ed8", bg: "rgba(37,99,235,0.1)" },
  accepted: { color: "#15803d", bg: "rgba(22,163,74,0.08)" },
  sent: { color: "#15803d", bg: "rgba(22,163,74,0.1)" },
  delivered: { color: "#15803d", bg: "rgba(22,163,74,0.14)" },
  read: { color: "#0e7490", bg: "rgba(8,145,178,0.12)" },
  failed: { color: "#b91c1c", bg: "rgba(220,38,38,0.1)" },
  skipped: { color: "#b45309", bg: "rgba(234,179,8,0.12)" },
};

function recipientLabel(status: string): string {
  return (WA_CAMPAIGNS.recipientStatus as Record<string, string>)[status] ?? status;
}

function CampaignDetailDrawer({
  detail,
  onClose,
  onRetry,
  onCancel,
  onRefresh,
  pending,
}: {
  detail: CampaignDetail;
  onClose: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  pending: boolean;
}) {
  const canRetry = detail.counts.failed > 0;
  const canCancel = ["queued", "processing"].includes(detail.status);

  // This drawer only renders after a click (never during SSR), so guarding on
  // document is enough — no state/effect needed.
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" dir="rtl">
        <div className="relative flex w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-lg sm:rounded-2xl" style={{ background: "var(--surface,#fff)", maxHeight: "92dvh" }}>
          <div className="flex shrink-0 items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--foreground,#1a1a2e)" }}>{WA_CAMPAIGNS.progress.viewDetails}</h2>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onRefresh} disabled={pending} className="rounded-full p-1.5 hover:opacity-70 disabled:opacity-40" style={{ color: "var(--muted,#888)" }} title="רענון">
                <RotateCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:opacity-70" style={{ color: "var(--muted,#888)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid grid-cols-3 gap-2">
              {([
                [WA_CAMPAIGNS.progress.accepted, detail.counts.accepted + detail.counts.sent + detail.counts.delivered + detail.counts.read],
                [WA_CAMPAIGNS.progress.delivered, detail.counts.delivered + detail.counts.read],
                [WA_CAMPAIGNS.progress.read, detail.counts.read],
                [WA_CAMPAIGNS.progress.failed, detail.counts.failed],
                [WA_CAMPAIGNS.progress.skipped, detail.counts.skipped],
                [WA_CAMPAIGNS.progress.queued, detail.counts.queued + detail.counts.processing],
              ] as Array<[string, number]>).map(([label, value]) => (
                <div key={label} className="rounded-lg px-2 py-2 text-center" style={{ background: "rgba(0,0,0,0.03)" }}>
                  <p className="text-base font-bold" style={{ color: "var(--foreground,#1a1a2e)" }}>{value}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted,#888)" }}>{label}</p>
                </div>
              ))}
            </div>

            {(canRetry || canCancel) && (
              <div className="flex gap-2">
                {canRetry && (
                  <button type="button" onClick={onRetry} disabled={pending} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(22,163,74,0.1)", color: "#15803d" }}>
                    <RotateCw className="h-3.5 w-3.5" /> {WA_CAMPAIGNS.progress.retryFailed}
                  </button>
                )}
                {canCancel && (
                  <button type="button" onClick={onCancel} disabled={pending} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(220,38,38,0.08)", color: "#b91c1c" }}>
                    <Ban className="h-3.5 w-3.5" /> {WA_CAMPAIGNS.progress.cancel}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {detail.recipients.map((r) => {
                const s = RECIPIENT_STYLE[r.status] ?? RECIPIENT_STYLE.queued;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <div className="min-w-0">
                      <span className="font-medium" style={{ color: "var(--foreground,#1a1a2e)" }}>{r.clientName}</span>
                      <span className="mr-2 text-xs" dir="ltr" style={{ color: "var(--muted,#888)" }}>{r.maskedPhone}</span>
                      {(r.skipReason || r.errorMessage) && (
                        <p className="text-[11px]" style={{ color: "#b45309" }}>{r.skipReason ?? r.errorMessage}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: s.color, background: s.bg }}>{recipientLabel(r.status)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
