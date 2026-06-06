"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DepositStatusBadge } from "@/components/deposits/deposit-status-badge";
import { DEPOSITS } from "@/lib/constants/he";
import type { DepositStatus } from "@prisma/client";
import type { DepositPaymentInfo } from "@/server/deposits/queries";
import type { DepositActionResult } from "@/server/deposits/actions";

interface BookingDepositCardProps {
  depositStatus: DepositStatus;
  depositAmountSnapshot: number | null;
  depositPayment: DepositPaymentInfo | null;
  updateDepositAction: (
    newStatus: "pending" | "paid" | "refunded",
  ) => Promise<DepositActionResult>;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BookingDepositCard({
  depositStatus,
  depositAmountSnapshot,
  depositPayment,
  updateDepositAction,
}: BookingDepositCardProps) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = (newStatus: "pending" | "paid" | "refunded", msg: string) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateDepositAction(newStatus);
      if (result.success) {
        setSuccessMsg(msg);
      } else {
        setErrorMsg(result.error ?? DEPOSITS.errors.generic);
      }
    });
  };

  const amount = depositAmountSnapshot;
  const markedPaidAt = depositPayment?.markedPaidAt ?? null;
  const refundedAt = depositPayment?.refundedAt ?? null;

  return (
    <Card className="space-y-4 p-5">
      <p className="text-muted text-xs font-semibold uppercase tracking-wider">
        {DEPOSITS.sectionTitle}
      </p>

      {/* Deposit info rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted text-sm">{DEPOSITS.labels.status}</span>
          <DepositStatusBadge status={depositStatus} />
        </div>

        {amount !== null && amount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-sm">{DEPOSITS.labels.amount}</span>
            <span className="text-foreground text-sm font-medium">
              ₪{amount.toLocaleString("he-IL")}
            </span>
          </div>
        )}

        {markedPaidAt && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-sm">{DEPOSITS.labels.paidAt}</span>
            <span className="text-muted text-sm">{formatDate(markedPaidAt)}</span>
          </div>
        )}

        {refundedAt && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-sm">{DEPOSITS.labels.refundedAt}</span>
            <span className="text-muted text-sm">{formatDate(refundedAt)}</span>
          </div>
        )}
      </div>

      {/* Feedback messages */}
      {successMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Action buttons — only shown when deposit is required */}
      {depositStatus !== "not_required" && (
        <div className="space-y-2">
          {depositStatus === "pending" && (
            <Button
              className="w-full"
              disabled={isPending}
              onClick={() => run("paid", DEPOSITS.success.markedPaid)}
            >
              {DEPOSITS.actions.markPaid}
            </Button>
          )}

          {depositStatus === "paid" && (
            <>
              <Button
                variant="secondary"
                className="w-full"
                disabled={isPending}
                onClick={() => run("refunded", DEPOSITS.success.markedRefunded)}
              >
                {DEPOSITS.actions.markRefunded}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={isPending}
                onClick={() => run("pending", DEPOSITS.success.markedPending)}
              >
                {DEPOSITS.actions.markPending}
              </Button>
            </>
          )}

          {depositStatus === "refunded" && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={isPending}
              onClick={() => run("pending", DEPOSITS.success.markedPending)}
            >
              {DEPOSITS.actions.markPending}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
