"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SETTINGS } from "@/lib/constants/he";
import type { CancellationPolicyFormState } from "@/server/settings/actions";
import type { updateCancellationPolicyAction } from "@/server/settings/actions";
import type { CancellationPolicyData } from "@/server/settings/queries";

const INITIAL: CancellationPolicyFormState = {};

const LATE_WINDOW_PRESETS = ["6", "12", "24", "48"] as const;
type LateWindowPreset = (typeof LATE_WINDOW_PRESETS)[number] | "custom";

function generatePolicyText(
  hours: number | undefined,
  feeType: string,
  feeAmount: string,
  feePercentage: string,
  businessName?: string,
): string {
  if (!hours) {
    return "ניתן לבטל או לשנות תור עד 24 שעות לפני מועד התור. ביטול מאוחר או אי־הגעה עשויים לחייב דמי ביטול.";
  }

  let feeText = "";
  if (feeType === "fixed" && feeAmount) {
    feeText = `₪${feeAmount}`;
  } else if (feeType === "percentage" && feePercentage) {
    feeText = `${feePercentage}% ממחיר השירות`;
  }

  const businessPart = businessName ? ` אצל ${businessName}` : "";
  const feePart = feeText
    ? ` עשוי לחייב דמי ביטול של ${feeText}`
    : " עשוי לחייב דמי ביטול";

  return `ניתן לבטל או לשנות תור${businessPart} עד ${hours} שעות לפני מועד התור. ביטול מאוחר או אי־הגעה${feePart}.`;
}

export function CancellationPolicyForm({
  action,
  initialValues,
}: {
  action: typeof updateCancellationPolicyAction;
  initialValues: CancellationPolicyData | null;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const initLateHours = initialValues?.lateCancellationHours?.toString() ?? "24";
  const isPreset = LATE_WINDOW_PRESETS.includes(initLateHours as (typeof LATE_WINDOW_PRESETS)[number]);

  const [enabled, setEnabled] = useState(initialValues?.enabled ?? false);
  const [policyText, setPolicyText] = useState(initialValues?.policyText ?? "");
  const [lateWindowPreset, setLateWindowPreset] = useState<LateWindowPreset>(
    isPreset ? (initLateHours as LateWindowPreset) : "custom",
  );
  const [customHours, setCustomHours] = useState(
    !isPreset ? initLateHours : "",
  );
  const [feeType, setFeeType] = useState(
    initialValues?.lateCancellationFeeType ?? "none",
  );
  const [feeAmount, setFeeAmount] = useState(
    initialValues?.lateCancellationFeeAmount ?? "",
  );
  const [feePercentage, setFeePercentage] = useState(
    initialValues?.lateCancellationFeePercentage ?? "",
  );
  const [requireDepositToBook, setRequireDepositToBook] = useState(
    initialValues?.requireDepositToBook ?? false,
  );

  const resolvedHours =
    lateWindowPreset === "custom"
      ? parseInt(customHours, 10) || undefined
      : parseInt(lateWindowPreset, 10);

  const lateCancellationHoursValue =
    lateWindowPreset === "custom" ? customHours : lateWindowPreset;

  const lateWindowLabel = SETTINGS.cancellationPolicy.lateWindowOptions;

  function handleGenerateText() {
    setPolicyText(
      generatePolicyText(resolvedHours, feeType, feeAmount ?? "", feePercentage ?? ""),
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      <p className="text-muted text-sm leading-relaxed">
        {SETTINGS.cancellationPolicy.hint}
      </p>

      {/* Enable/disable toggle */}
      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            value="true"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 rounded accent-primary"
          />
          <span className="text-foreground font-semibold">
            {SETTINGS.cancellationPolicy.enabledLabel}
          </span>
        </label>
        <p className="text-muted pr-8 text-xs leading-relaxed">
          {SETTINGS.cancellationPolicy.enabledHint}
        </p>
      </div>

      {/* Policy details — only show when enabled */}
      {enabled && (
        <div className="space-y-5 rounded-xl border border-[var(--border)] p-4">

          {/* Late cancellation window */}
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              {SETTINGS.cancellationPolicy.lateWindowLabel}
            </p>
            <p className="text-muted text-xs">
              {SETTINGS.cancellationPolicy.lateWindowHint}
            </p>
            <div className="flex flex-wrap gap-2">
              {LATE_WINDOW_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLateWindowPreset(preset)}
                  className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  style={
                    lateWindowPreset === preset
                      ? {
                          background: "rgba(184,107,140,0.12)",
                          borderColor: "#b86b8c",
                          color: "#b86b8c",
                          fontWeight: 600,
                        }
                      : {
                          borderColor: "var(--border)",
                          color: "var(--foreground-soft)",
                        }
                  }
                >
                  {lateWindowLabel[preset]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLateWindowPreset("custom")}
                className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                style={
                  lateWindowPreset === "custom"
                    ? {
                        background: "rgba(184,107,140,0.12)",
                        borderColor: "#b86b8c",
                        color: "#b86b8c",
                        fontWeight: 600,
                      }
                    : {
                        borderColor: "var(--border)",
                        color: "var(--foreground-soft)",
                      }
                }
              >
                {lateWindowLabel.custom}
              </button>
            </div>
            {lateWindowPreset === "custom" && (
              <Field
                label={SETTINGS.cancellationPolicy.customHoursLabel}
                htmlFor="customHours"
                error={state.errors?.lateCancellationHours}
              >
                <Input
                  id="customHours"
                  type="number"
                  min="1"
                  placeholder={SETTINGS.cancellationPolicy.customHoursPlaceholder}
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  className="w-36"
                />
              </Field>
            )}
            {/* Hidden input to submit the actual hours value */}
            <input
              type="hidden"
              name="lateCancellationHours"
              value={lateCancellationHoursValue}
            />
          </div>

          {/* Fee type */}
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">
              {SETTINGS.cancellationPolicy.feeTypeLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["none", "fixed", "percentage"] as const).map((type) => {
                const label =
                  type === "none"
                    ? SETTINGS.cancellationPolicy.feeTypeNone
                    : type === "fixed"
                      ? SETTINGS.cancellationPolicy.feeTypeFixed
                      : SETTINGS.cancellationPolicy.feeTypePercentage;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFeeType(type)}
                    className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                    style={
                      feeType === type
                        ? {
                            background: "rgba(184,107,140,0.12)",
                            borderColor: "#b86b8c",
                            color: "#b86b8c",
                            fontWeight: 600,
                          }
                        : {
                            borderColor: "var(--border)",
                            color: "var(--foreground-soft)",
                          }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="lateCancellationFeeType" value={feeType} />

            {feeType === "fixed" && (
              <Field
                label={SETTINGS.cancellationPolicy.feeAmountLabel}
                htmlFor="lateCancellationFeeAmount"
                error={state.errors?.lateCancellationFeeAmount}
              >
                <Input
                  id="lateCancellationFeeAmount"
                  name="lateCancellationFeeAmount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={SETTINGS.cancellationPolicy.feeAmountPlaceholder}
                  value={feeAmount ?? ""}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="w-36"
                />
              </Field>
            )}

            {feeType === "percentage" && (
              <Field
                label={SETTINGS.cancellationPolicy.feePercentageLabel}
                htmlFor="lateCancellationFeePercentage"
                error={state.errors?.lateCancellationFeePercentage}
              >
                <Input
                  id="lateCancellationFeePercentage"
                  name="lateCancellationFeePercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder={SETTINGS.cancellationPolicy.feePercentagePlaceholder}
                  value={feePercentage ?? ""}
                  onChange={(e) => setFeePercentage(e.target.value)}
                  className="w-36"
                />
              </Field>
            )}
          </div>

          {/* Policy text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-foreground text-sm font-medium">
                {SETTINGS.cancellationPolicy.policyTextLabel}
              </p>
              <button
                type="button"
                onClick={handleGenerateText}
                className="text-xs font-medium underline underline-offset-2"
                style={{ color: "#b86b8c" }}
              >
                {SETTINGS.cancellationPolicy.generateTextButton}
              </button>
            </div>
            <Textarea
              id="policyText"
              name="policyText"
              placeholder={SETTINGS.cancellationPolicy.policyTextPlaceholder}
              rows={3}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
            />
            <p className="text-muted text-xs">
              {SETTINGS.cancellationPolicy.policyTextHint}
            </p>
          </div>

          {/* Manual fee note */}
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(59,122,181,0.06)",
              color: "#2e5c8a",
              border: "1px solid rgba(59,122,181,0.18)",
            }}
          >
            {SETTINGS.cancellationPolicy.manualFeeNote}
          </div>
        </div>
      )}

      {/* Require deposit */}
      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="requireDepositToBook"
            value="true"
            checked={requireDepositToBook}
            onChange={(e) => setRequireDepositToBook(e.target.checked)}
            className="h-5 w-5 rounded accent-primary"
          />
          <span className="text-foreground font-medium">
            {SETTINGS.cancellationPolicy.requireDepositLabel}
          </span>
        </label>
        <p className="text-muted pr-8 text-xs leading-relaxed">
          {SETTINGS.cancellationPolicy.requireDepositHint}
        </p>
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending
          ? SETTINGS.cancellationPolicy.saving
          : SETTINGS.cancellationPolicy.saveButton}
      </Button>
    </form>
  );
}
