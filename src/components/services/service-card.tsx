import Link from "next/link";
import { Clock, Banknote, CreditCard, Sparkles } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ToggleServiceButton } from "./toggle-service-button";
import { SERVICES } from "@/lib/constants/he";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: Prisma.Decimal;
    requiresDeposit: boolean;
    depositAmount: Prisma.Decimal | null;
    isActive: boolean;
  };
};

function formatMinutes(minutes: number): string {
  if (minutes === 15) return "15 דקות";
  if (minutes === 30) return "30 דקות";
  if (minutes === 45) return "45 דקות";
  if (minutes === 60) return "שעה";
  if (minutes === 75) return "שעה ורבע";
  if (minutes === 90) return "שעה וחצי";
  if (minutes === 120) return "שעתיים";
  if (minutes === 150) return "שעתיים וחצי";
  if (minutes === 180) return "שלוש שעות";
  return `${minutes} דקות`;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const depositDisplay =
    service.requiresDeposit && service.depositAmount
      ? `₪${Number(service.depositAmount).toLocaleString("en-US")}`
      : SERVICES.card.noDeposit;

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-md ${!service.isActive ? "opacity-60" : ""}`}
      style={{ padding: 0 }}
    >
      {/* Tinted header with icon + name */}
      <div
        className="px-5 pt-4 pb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(247,238,243,0.80) 0%, rgba(247,232,243,0.55) 100%)",
          borderBottom: "1px solid rgba(184,107,140,0.09)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5"
              style={{ background: "rgba(184,107,140,0.12)" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground min-w-0 truncate text-base font-semibold leading-snug">
                {service.name}
              </h3>
              {service.description && (
                <p className="text-muted mt-1 line-clamp-2 text-sm leading-5">
                  {service.description}
                </p>
              )}
            </div>
          </div>
          <StatusBadge tone={service.isActive ? "success" : "neutral"}>
            {service.isActive ? SERVICES.card.active : SERVICES.card.inactive}
          </StatusBadge>
        </div>
      </div>

      {/* Metadata + actions */}
      <div className="px-5 py-4">
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
          <span className="flex items-center gap-1.5 text-sm">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-foreground font-medium">
              {formatMinutes(service.durationMinutes)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <Banknote className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-foreground font-medium">
              ₪{Number(service.price).toLocaleString("en-US")}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-foreground font-medium">{depositDisplay}</span>
          </span>
        </div>
        <div className="border-border flex items-center gap-2 border-t pt-3">
          <Link href={`/services/${service.id}`}>
            <Button variant="secondary" size="sm">
              {SERVICES.card.editButton}
            </Button>
          </Link>
          <ToggleServiceButton
            serviceId={service.id}
            isActive={service.isActive}
          />
        </div>
      </div>
    </Card>
  );
}
