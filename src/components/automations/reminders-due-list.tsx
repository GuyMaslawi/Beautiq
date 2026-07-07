"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Copy,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { AUTOMATIONS } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { ReminderDueItem } from "@/server/automations/queries";
import {
  markReminderSentAction,
  markReminderPendingAction,
} from "@/server/automations/actions";

const TZ = "Asia/Jerusalem";
const c = AUTOMATIONS.reminders.dueList;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getInitial(name: string): string {
  return name.trim()[0] ?? "?";
}

function StatusBadge({
  status,
}: {
  status: ReminderDueItem["reminderStatus"];
}) {
  const key = status ?? "none";
  const label = c.status[key] ?? c.status.none;

  const style: React.CSSProperties =
    status === "sent"
      ? { background: "rgba(61,139,110,0.10)", color: "#3d8b6e" }
      : status === "cancelled"
        ? { background: "rgba(190,74,74,0.08)", color: "#be4a4a" }
        : { background: "rgba(184,150,10,0.10)", color: "#b87c1e" };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={style}
    >
      {label}
    </span>
  );
}

function ReminderCard({
  item,
  reminderHours,
}: {
  item: ReminderDueItem;
  reminderHours: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [localStatus, setLocalStatus] = useState<
    ReminderDueItem["reminderStatus"]
  >(item.reminderStatus);
  const [localReminderId] = useState(item.reminderId);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(item.message);
    } catch {
      // fallback — do nothing, user can see the message
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMarkSent() {
    startTransition(async () => {
      const result = await markReminderSentAction(item.bookingId);
      if (!result.error) {
        setLocalStatus("sent");
      }
    });
  }

  function handleMarkPending() {
    if (!localReminderId) return;
    startTransition(async () => {
      const result = await markReminderPendingAction(localReminderId);
      if (!result.error) {
        setLocalStatus("pending");
      }
    });
  }

  const wasSent = localStatus === "sent";
  const isCancelled = localStatus === "cancelled";

  const waLink = buildWhatsAppUrl(item.phone, item.message);

  return (
    <div
      className="rounded-2xl p-4 transition-shadow hover:shadow-md"
      style={{
        background: "var(--surface)",
        border: `1px solid ${wasSent ? "rgba(61,139,110,0.20)" : "var(--border)"}`,
        opacity: isCancelled ? 0.6 : 1,
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, rgba(199,111,147,0.85) 0%, rgba(172,92,127,0.75) 100%)",
            }}
          >
            {getInitial(item.clientName)}
          </div>

          {/* Name + service */}
          <div>
            <p
              className="font-semibold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {item.clientName}
            </p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {item.serviceName}
            </p>
          </div>
        </div>

        <StatusBadge status={localStatus} />
      </div>

      {/* Date + timing */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#ac5c7f" }} />
          {formatDateTime(item.startTimeISO)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: "rgba(172,92,127,0.08)",
            color: "#ac5c7f",
          }}
        >
          {c.reminderIn(reminderHours)}
        </span>
        <a
          href={`tel:${item.phone}`}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          {item.phone}
        </a>
      </div>

      {/* Message preview */}
      <div
        className="mt-3 rounded-xl px-3.5 py-3 text-sm leading-relaxed"
        style={{
          background: "var(--background-alt)",
          border: "1px solid var(--border)",
          color: "var(--foreground-soft)",
          direction: "rtl",
          whiteSpace: "pre-wrap",
        }}
      >
        {item.message}
      </div>

      {/* Actions */}
      {!isCancelled && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* WhatsApp */}
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #25d366 0%, #1ebe5d 100%)",
                boxShadow: "0 2px 8px rgba(37,211,102,0.25)",
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {c.actionWhatsApp}
            </a>
          ) : (
            <span
              className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
              title="מספר טלפון לא תקין"
              style={{ background: "linear-gradient(135deg, #25d366 0%, #1ebe5d 100%)" }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {c.actionWhatsApp}
            </span>
          )}

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--background-alt)",
              border: "1px solid var(--border)",
              color: "var(--foreground-soft)",
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? c.messageCopied : c.actionCopy}
          </button>

          {/* Mark sent / pending */}
          {!wasSent ? (
            <button
              type="button"
              onClick={handleMarkSent}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "rgba(61,139,110,0.08)",
                border: "1px solid rgba(61,139,110,0.20)",
                color: "#3d8b6e",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPending ? "…" : c.actionMarkSent}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMarkPending}
              disabled={isPending || !localReminderId}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "rgba(184,150,10,0.08)",
                border: "1px solid rgba(184,150,10,0.20)",
                color: "#b87c1e",
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isPending ? "…" : c.actionMarkPending}
            </button>
          )}

          {/* View booking */}
          <Link
            href={`/bookings/${item.bookingId}`}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {c.actionViewBooking}
          </Link>
        </div>
      )}
    </div>
  );
}

export function RemindersDueList({
  remindersDue,
  reminderHours,
}: {
  remindersDue: ReminderDueItem[];
  reminderHours: number;
}) {
  const dl = AUTOMATIONS.reminders.dueList;

  if (remindersDue.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(172,92,127,0.08)" }}
        >
          <CheckCircle2 className="h-6 w-6" style={{ color: "#ac5c7f" }} />
        </div>
        <p className="font-semibold" style={{ color: "var(--foreground)" }}>
          {dl.emptyTitle}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {dl.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {remindersDue.map((item) => (
        <ReminderCard
          key={item.bookingId}
          item={item}
          reminderHours={reminderHours}
        />
      ))}
    </div>
  );
}
