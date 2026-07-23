import { Crown, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlatinumPlan } from "@/lib/plans";

/**
 * A small tier icon for the account's self-serve plan — a gold crown for
 * Platinum, an orchid gem for Premium (see [[project_subscribe_paywall]]).
 * Renders nothing when there is no plan (e.g. admins/grandfathered nulls),
 * so callers can pass the plan value directly without guarding.
 */
export function PlanIcon({
  plan,
  className,
}: {
  /** The account plan value ("premium" | "platinum") or null. */
  plan: string | null | undefined;
  className?: string;
}) {
  if (!plan) return null;

  const platinum = isPlatinumPlan(plan);
  const Icon = platinum ? Crown : Gem;
  const label = platinum ? "מנוי פלטינום" : "מנוי פרימיום";
  const color = platinum ? "#c0912f" : "#ac5c7f";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center"
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} style={{ color }} aria-hidden />
    </span>
  );
}
