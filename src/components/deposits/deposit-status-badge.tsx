import type { DepositStatus } from "@prisma/client";
import { DEPOSITS } from "@/lib/constants/he";

const STATUS_STYLES: Record<DepositStatus, string> = {
  not_required: "border-border bg-surface text-muted",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-blue-200 bg-blue-50 text-blue-700",
};

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {DEPOSITS.status[status]}
    </span>
  );
}
