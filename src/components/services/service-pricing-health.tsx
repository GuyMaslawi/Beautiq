"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle2, TrendingUp } from "lucide-react";
import { MarketRangeForm } from "@/components/pricing/market-range-form";
import type { PricingServiceData } from "@/server/pricing/queries";
import type { PricingInsight } from "@/lib/pricing/insights";
import { PRICING } from "@/lib/constants/he";

function formatILS(amount: number): string {
  return `₪${Math.round(amount).toLocaleString("en-US")}`;
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
    <div className="rounded-xl px-3 py-2.5 space-y-0.5" style={{ background: style.bg }}>
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

interface ServicePricingHealthProps {
  service: PricingServiceData;
  insights: PricingInsight[];
  businessAvgPricePerHour: number;
}

/**
 * Per-service pricing health, shown on the service detail page (Phase 3
 * recommendation). Surfaces price-per-hour vs. the business average, any
 * flagged insight, and lets the owner set the market range without leaving
 * the service experience. Reuses the existing pricing insight logic + form.
 */
export function ServicePricingHealth({
  service,
  insights,
  businessAvgPricePerHour,
}: ServicePricingHealthProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const handleSaved = useCallback(() => setRangeOpen(false), []);

  const hasMarketRange =
    service.marketMinPrice !== null || service.marketMaxPrice !== null;

  const relPct =
    businessAvgPricePerHour > 0
      ? Math.round((service.pricePerHour / businessAvgPricePerHour) * 100)
      : null;

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      dir="rtl"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: "#b86b8c" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            בריאות תמחור
          </h3>
        </div>

        {/* Price-per-hour vs business average */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>{PRICING.card.pricePerHour}</p>
            <p className="text-base font-bold" style={{ color: "#b86b8c" }}>
              {formatILS(service.pricePerHour)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs" style={{ color: "#8a8190" }}>ממוצע בעסק לשעה</p>
            <p className="text-base font-bold" style={{ color: "#2b2530" }}>
              {businessAvgPricePerHour > 0 ? formatILS(businessAvgPricePerHour) : "—"}
            </p>
          </div>
          {relPct !== null && (
            <div className="space-y-0.5">
              <p className="text-xs" style={{ color: "#8a8190" }}>ביחס לממוצע</p>
              <p
                className="text-base font-bold"
                style={{ color: relPct >= 100 ? "#3d8b6e" : "#b86020" }}
              >
                {relPct}%
              </p>
            </div>
          )}
        </div>

        {/* Market range display */}
        {hasMarketRange && (
          <div className="rounded-xl px-3 py-2.5 space-y-1" style={{ background: "rgba(43,37,48,0.04)" }}>
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

        {!hasMarketRange && insights.length === 0 && (
          <p className="text-xs" style={{ color: "#bbb3c2" }}>
            {PRICING.card.noRange}
          </p>
        )}

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
    </div>
  );
}
