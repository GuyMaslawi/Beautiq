"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MarketRangeForm } from "@/components/pricing/market-range-form";
import type { PricingServiceData } from "@/server/pricing/queries";
import type { PricingInsight } from "@/lib/pricing/insights";
import { PRICING } from "@/lib/constants/he";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} שעה`;
  return `${h}:${String(m).padStart(2, "0")} שעות`;
}

function InsightChip({ insight }: { insight: PricingInsight }) {
  const styles: Record<PricingInsight["severity"], { bg: string; color: string }> = {
    warning: { bg: "rgba(220,120,40,0.08)", color: "#b86020" },
    info: { bg: "rgba(43,37,48,0.06)", color: "#6b5f75" },
    positive: { bg: "rgba(61,139,110,0.08)", color: "#3d8b6e" },
  };
  const style = styles[insight.severity];

  const Icon =
    insight.severity === "warning"
      ? AlertTriangle
      : insight.severity === "positive"
        ? CheckCircle2
        : Info;

  return (
    <div
      className="rounded-xl px-3 py-2.5 space-y-0.5"
      style={{ background: style.bg }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: style.color }} />
        <span className="text-xs font-semibold" style={{ color: style.color }}>
          {insight.title}
        </span>
      </div>
      <p className="text-xs leading-relaxed pr-5" style={{ color: "#6b5f75" }}>
        {insight.body}
      </p>
    </div>
  );
}

interface PricingServiceCardProps {
  service: PricingServiceData;
  insights: PricingInsight[];
}

export function PricingServiceCard({ service, insights }: PricingServiceCardProps) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const handleSaved = useCallback(() => {
    setRangeOpen(false);
  }, []);

  const hasMarketRange =
    service.marketMinPrice !== null || service.marketMaxPrice !== null;

  return (
    <Card variant="default" className="p-0 overflow-hidden">
      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-foreground font-semibold text-sm leading-snug">
                {service.name}
              </h3>
              {!service.isActive && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: "rgba(43,37,48,0.07)", color: "#8a8190" }}
                >
                  לא פעיל
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/services/${service.id}`}
            className="shrink-0 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "#b86b8c" }}
          >
            {PRICING.card.editService}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>{PRICING.card.price}</p>
            <p className="text-base font-bold" style={{ color: "#2b2530" }}>
              {formatILS(service.price)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>{PRICING.card.pricePerHour}</p>
            <p className="text-base font-bold" style={{ color: "#b86b8c" }}>
              {formatILS(service.pricePerHour)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>{PRICING.card.duration}</p>
            <p className="text-sm font-medium" style={{ color: "#2b2530" }}>
              {formatDuration(service.durationMinutes)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>{PRICING.card.deposit}</p>
            <p className="text-sm font-medium" style={{ color: "#2b2530" }}>
              {service.requiresDeposit && service.depositAmount !== null
                ? formatILS(service.depositAmount)
                : service.requiresDeposit
                  ? "נדרשת"
                  : PRICING.card.noDeposit}
            </p>
          </div>
        </div>

        {/* Completed bookings */}
        {service.completedBookingCount > 0 && (
          <p className="text-xs" style={{ color: "#8a8190" }}>
            {PRICING.card.completedBookings}:{" "}
            <span className="font-medium" style={{ color: "#2b2530" }}>
              {service.completedBookingCount}
            </span>
          </p>
        )}

        {/* Market range display */}
        {hasMarketRange && (
          <div
            className="rounded-xl px-3 py-2.5 space-y-1"
            style={{ background: "rgba(43,37,48,0.04)" }}
          >
            <p className="text-xs font-semibold" style={{ color: "#6b5f75" }}>
              {PRICING.marketRange.sectionTitle}
            </p>
            <div className="flex gap-4 text-xs" style={{ color: "#8a8190" }}>
              {service.marketMinPrice !== null && (
                <span>
                  {PRICING.card.rangeMin}:{" "}
                  <span className="font-medium" style={{ color: "#2b2530" }}>
                    {formatILS(service.marketMinPrice)}
                  </span>
                </span>
              )}
              {service.marketAveragePrice !== null && (
                <span>
                  {PRICING.card.rangeAvg}:{" "}
                  <span className="font-medium" style={{ color: "#2b2530" }}>
                    {formatILS(service.marketAveragePrice)}
                  </span>
                </span>
              )}
              {service.marketMaxPrice !== null && (
                <span>
                  {PRICING.card.rangeMax}:{" "}
                  <span className="font-medium" style={{ color: "#2b2530" }}>
                    {formatILS(service.marketMaxPrice)}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            {insights.map((insight) => (
              <InsightChip key={insight.type} insight={insight} />
            ))}
          </div>
        )}

        {/* Inactive note or no-range placeholder */}
        {!service.isActive ? (
          <p className="text-xs" style={{ color: "#8a8190" }}>
            {PRICING.card.inactiveNote}
          </p>
        ) : !hasMarketRange && insights.length === 0 ? (
          <p className="text-xs" style={{ color: "#bbb3c2" }}>
            {PRICING.card.noRange}
          </p>
        ) : null}

        {/* Edit range toggle */}
        <button
          type="button"
          onClick={() => setRangeOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: "#b86b8c" }}
        >
          {rangeOpen ? (
            <>
              {PRICING.card.cancelEdit}
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              {PRICING.card.editRange}
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Market range form (collapsible) */}
      {rangeOpen && (
        <div
          className="border-t px-5 py-4"
          style={{ borderColor: "var(--border)", background: "rgba(247,238,243,0.35)" }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: "#6b5f75" }}>
            {PRICING.marketRange.sectionTitle}
            <span className="mr-1.5 font-normal" style={{ color: "#bbb3c2" }}>
              — {PRICING.marketRange.sectionOptional}
            </span>
          </p>
          <MarketRangeForm
            serviceId={service.id}
            marketMinPrice={service.marketMinPrice}
            marketAveragePrice={service.marketAveragePrice}
            marketMaxPrice={service.marketMaxPrice}
            onSaved={handleSaved}
          />
        </div>
      )}
    </Card>
  );
}
