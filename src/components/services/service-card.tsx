import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { ToggleServiceButton } from "./toggle-service-button";
import { SERVICES } from "@/lib/constants/he";
import { ServiceShowcaseCard } from "@/components/premium/service-showcase-card";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: Prisma.Decimal;
    isActive: boolean;
  };
  /** Optional pricing-health hint shown when this service has a flagged insight. */
  pricingBadge?: string;
};

function formatMinutes(minutes: number): string {
  if (minutes === 15) return "15 דק׳";
  if (minutes === 30) return "30 דק׳";
  if (minutes === 45) return "45 דק׳";
  if (minutes === 60) return "שעה";
  if (minutes === 75) return "שעה ורבע";
  if (minutes === 90) return "שעה וחצי";
  if (minutes === 120) return "שעתיים";
  if (minutes === 150) return "שעתיים וחצי";
  if (minutes === 180) return "שלוש שעות";
  return `${minutes} דק׳`;
}

export function ServiceCard({ service, pricingBadge }: ServiceCardProps) {
  return (
    <ServiceShowcaseCard
      name={service.name}
      description={service.description}
      tint="champagne"
      inactive={!service.isActive}
      price={`₪${Number(service.price).toLocaleString("en-US")}`}
      duration={
        <>
          <Clock className="h-3.5 w-3.5" />
          <span className="font-semibold" style={{ color: "var(--foreground-soft)" }}>
            {formatMinutes(service.durationMinutes)}
          </span>
        </>
      }
      control={<ToggleServiceButton serviceId={service.id} isActive={service.isActive} />}
      footer={
        <div className="flex items-center gap-2">
          <Link
            href={`/services/${service.id}`}
            className="flex h-8 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium transition-all hover:shadow-sm"
            style={{ borderColor: "var(--border)", color: "var(--foreground-soft)", background: "var(--surface)" }}
          >
            {SERVICES.card.editButton}
          </Link>
          {pricingBadge && (
            <Link
              href={`/services/${service.id}`}
              className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: "rgba(220,120,40,0.08)", color: "#b86020", border: "1px solid rgba(220,120,40,0.20)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {pricingBadge}
            </Link>
          )}
        </div>
      }
    />
  );
}
