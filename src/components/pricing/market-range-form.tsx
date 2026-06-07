"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveMarketRangeAction, type MarketRangeFormState } from "@/server/pricing/actions";
import { Button } from "@/components/ui/button";
import { PRICING } from "@/lib/constants/he";

interface MarketRangeFormProps {
  serviceId: string;
  marketMinPrice: number | null;
  marketAveragePrice: number | null;
  marketMaxPrice: number | null;
  onSaved: () => void;
}

const initialState: MarketRangeFormState = {};

export function MarketRangeForm({
  serviceId,
  marketMinPrice,
  marketAveragePrice,
  marketMaxPrice,
  onSaved,
}: MarketRangeFormProps) {
  const boundAction = saveMarketRangeAction.bind(null, serviceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const savedRef = useRef(false);

  useEffect(() => {
    if (state.success && !savedRef.current) {
      savedRef.current = true;
      onSaved();
    }
  }, [state.success, onSaved]);

  return (
    <form action={formAction} className="space-y-3" dir="rtl">
      <p className="text-xs leading-relaxed" style={{ color: "#8a8190" }}>
        {PRICING.marketRange.hint}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "#6b5f75" }}>
            {PRICING.marketRange.minLabel}
          </label>
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#bbb3c2" }}>
              ₪
            </span>
            <input
              name="marketMinPrice"
              type="number"
              min="0"
              step="1"
              defaultValue={marketMinPrice ?? ""}
              placeholder={PRICING.marketRange.minPlaceholder}
              className="w-full rounded-lg border py-2 pr-7 pl-2 text-sm text-right"
              style={{
                borderColor: state.fieldErrors?.min ? "#e05a7a" : "var(--border)",
                background: "#fafafa",
                outline: "none",
              }}
            />
          </div>
          {state.fieldErrors?.min && (
            <p className="text-xs" style={{ color: "#e05a7a" }}>{state.fieldErrors.min}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "#6b5f75" }}>
            {PRICING.marketRange.avgLabel}
          </label>
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#bbb3c2" }}>
              ₪
            </span>
            <input
              name="marketAveragePrice"
              type="number"
              min="0"
              step="1"
              defaultValue={marketAveragePrice ?? ""}
              placeholder={PRICING.marketRange.avgPlaceholder}
              className="w-full rounded-lg border py-2 pr-7 pl-2 text-sm text-right"
              style={{
                borderColor: state.fieldErrors?.avg ? "#e05a7a" : "var(--border)",
                background: "#fafafa",
                outline: "none",
              }}
            />
          </div>
          {state.fieldErrors?.avg && (
            <p className="text-xs" style={{ color: "#e05a7a" }}>{state.fieldErrors.avg}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "#6b5f75" }}>
            {PRICING.marketRange.maxLabel}
          </label>
          <div className="relative">
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#bbb3c2" }}>
              ₪
            </span>
            <input
              name="marketMaxPrice"
              type="number"
              min="0"
              step="1"
              defaultValue={marketMaxPrice ?? ""}
              placeholder={PRICING.marketRange.maxPlaceholder}
              className="w-full rounded-lg border py-2 pr-7 pl-2 text-sm text-right"
              style={{
                borderColor: state.fieldErrors?.max ? "#e05a7a" : "var(--border)",
                background: "#fafafa",
                outline: "none",
              }}
            />
          </div>
          {state.fieldErrors?.max && (
            <p className="text-xs" style={{ color: "#e05a7a" }}>{state.fieldErrors.max}</p>
          )}
        </div>
      </div>

      {state.formError && (
        <p className="text-xs" style={{ color: "#e05a7a" }}>{state.formError}</p>
      )}

      {state.success && (
        <p className="text-xs font-medium" style={{ color: "#3d8b6e" }}>
          {PRICING.marketRange.saved}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        variant="secondary"
      >
        {isPending ? PRICING.marketRange.saving : PRICING.marketRange.saveButton}
      </Button>
    </form>
  );
}
