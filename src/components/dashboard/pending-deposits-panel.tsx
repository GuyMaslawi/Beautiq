"use client";

import { useState } from "react";
import Link from "next/link";
import { updateDepositStatusAction } from "@/server/deposits/actions";
import { DASHBOARD } from "@/lib/constants/he";

export type PendingDepositItem = {
  id: string;
  startTimeISO: string;
  depositAmount: number | null;
  clientName: string;
  serviceName: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const bookingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (bookingDay.getTime() === todayStart.getTime()) return "היום";
  if (bookingDay.getTime() === tomorrowStart.getTime()) return "מחר";

  return d.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function PendingDepositsPanel({
  items,
}: {
  items: PendingDepositItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  // ids removed optimistically after marking paid
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const visible = items.filter((b) => !dismissed.has(b.id));

  if (visible.length === 0) return null;

  const countLabel =
    visible.length === 1
      ? DASHBOARD.pendingDeposits.alertSingular
      : `${visible.length} ${DASHBOARD.pendingDeposits.alertPluralSuffix}`;

  async function handleMarkPaid(id: string) {
    setLoadingId(id);
    const result = await updateDepositStatusAction(id, "paid");
    setLoadingId(null);
    if (result.success) {
      setDismissed((prev) => new Set([...prev, id]));
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-amber-100"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-base text-amber-600">💳</span>
          <p className="truncate text-sm font-medium text-amber-800">
            {countLabel}
          </p>
        </div>
        <span className="shrink-0 text-xs text-amber-600">
          {expanded
            ? DASHBOARD.pendingDeposits.collapseHint
            : DASHBOARD.pendingDeposits.expandHint}
        </span>
      </button>

      {/* Expandable list */}
      {expanded && (
        <div className="divide-y divide-amber-100 border-t border-amber-200">
          {visible.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-amber-900">
                  {booking.clientName}
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  {booking.serviceName}
                  {" · "}
                  {formatDate(booking.startTimeISO)}{" "}
                  {formatTime(booking.startTimeISO)}
                  {booking.depositAmount != null &&
                    ` · ₪${booking.depositAmount.toLocaleString("he-IL")}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/bookings/${booking.id}`}
                  className="text-xs text-amber-700 underline-offset-2 hover:underline"
                >
                  {DASHBOARD.pendingDeposits.viewDetails}
                </Link>
                <button
                  type="button"
                  onClick={() => handleMarkPaid(booking.id)}
                  disabled={loadingId === booking.id}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {loadingId === booking.id
                    ? DASHBOARD.pendingDeposits.marking
                    : DASHBOARD.pendingDeposits.markPaid}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
