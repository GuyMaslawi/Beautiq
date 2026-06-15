import Link from "next/link";
import { Clock, Banknote, Sparkles } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { ToggleServiceButton } from "./toggle-service-button";
import { SERVICES } from "@/lib/constants/he";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: Prisma.Decimal;
    isActive: boolean;
  };
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

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border transition-shadow hover:shadow-md"
      style={{
        background: "#fff",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(247,238,243,0.85) 0%, rgba(247,232,243,0.60) 100%)",
          borderBottom: "1px solid rgba(184,107,140,0.10)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(201,120,152,0.18) 0%, rgba(184,107,140,0.12) 100%)",
                border: "1px solid rgba(184,107,140,0.18)",
              }}
            >
              <Sparkles className="h-4.5 w-4.5" style={{ color: "#b86b8c" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-base font-bold leading-snug">
                {service.name}
              </h3>
              {service.description && (
                <p className="text-muted mt-1 line-clamp-2 text-sm leading-5">
                  {service.description}
                </p>
              )}
            </div>
          </div>

          {/* Active / inactive switch */}
          <ToggleServiceButton
            serviceId={service.id}
            isActive={service.isActive}
          />
        </div>
      </div>

      {/* Stats + actions */}
      <div className="px-5 py-4">
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">

          {/* Duration */}
          <span className="flex items-center gap-1.5 text-sm">
            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
            <span className="font-semibold" style={{ color: "var(--foreground-soft)" }}>
              {formatMinutes(service.durationMinutes)}
            </span>
          </span>

          {/* Price */}
          <span className="flex items-center gap-1.5 text-sm">
            <Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted)" }} />
            <span className="font-bold" style={{ color: "#b86b8c" }}>
              ₪{Number(service.price).toLocaleString("en-US")}
            </span>
          </span>

        </div>

        {/* Action bar */}
        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <Link
            href={`/services/${service.id}`}
            className="flex h-8 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium transition-all hover:shadow-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground-soft)",
              background: "var(--surface)",
            }}
          >
            {SERVICES.card.editButton}
          </Link>
        </div>
      </div>
    </div>
  );
}
