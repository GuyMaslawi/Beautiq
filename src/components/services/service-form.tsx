"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SERVICES } from "@/lib/constants/he";
import type { ServiceFormState } from "@/server/services/actions";

export interface ServiceInitialValues {
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: string;
  requiresDeposit?: boolean;
  depositAmount?: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  categoryKey?: string;
  isActive?: boolean;
}

const INITIAL: ServiceFormState = {};

const DURATION_OPTIONS = [
  { value: 15, label: "15 דקות" },
  { value: 30, label: "30 דקות" },
  { value: 45, label: "45 דקות" },
  { value: 60, label: "שעה" },
  { value: 75, label: "שעה ורבע" },
  { value: 90, label: "שעה וחצי" },
  { value: 120, label: "שעתיים" },
  { value: 150, label: "שעתיים וחצי" },
  { value: 180, label: "שלוש שעות" },
];

const CATEGORY_OPTIONS = [
  { value: "nails", label: SERVICES.categories.nails },
  { value: "brows", label: SERVICES.categories.brows },
  { value: "lashes", label: SERVICES.categories.lashes },
  { value: "hair", label: SERVICES.categories.hair },
  { value: "makeup", label: SERVICES.categories.makeup },
  { value: "cosmetics", label: SERVICES.categories.cosmetics },
  { value: "laser", label: SERVICES.categories.laser },
  { value: "aesthetics", label: SERVICES.categories.aesthetics },
  { value: "massage", label: SERVICES.categories.massage },
  { value: "spa", label: SERVICES.categories.spa },
  { value: "permanent_makeup", label: SERVICES.categories.permanent_makeup },
  { value: "other", label: SERVICES.categories.other },
];

const selectClass =
  "bg-surface border-border text-foreground h-11 w-full appearance-none rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary";

function initValues(
  serverValues: Record<string, string> | undefined,
  initialValues: ServiceInitialValues | undefined,
) {
  return {
    name: serverValues?.name ?? initialValues?.name ?? "",
    description: serverValues?.description ?? initialValues?.description ?? "",
    durationMinutes:
      serverValues?.durationMinutes ??
      initialValues?.durationMinutes?.toString() ??
      "",
    price: serverValues?.price ?? initialValues?.price ?? "",
    requiresDeposit:
      serverValues?.requiresDeposit ??
      (initialValues?.requiresDeposit ? "true" : "false"),
    depositAmount:
      serverValues?.depositAmount ?? initialValues?.depositAmount ?? "",
    bufferBeforeMinutes:
      serverValues?.bufferBeforeMinutes ??
      initialValues?.bufferBeforeMinutes?.toString() ??
      "0",
    bufferAfterMinutes:
      serverValues?.bufferAfterMinutes ??
      initialValues?.bufferAfterMinutes?.toString() ??
      "0",
    categoryKey:
      serverValues?.categoryKey ?? initialValues?.categoryKey ?? "",
    isActive:
      serverValues?.isActive ??
      ((initialValues?.isActive ?? true) ? "true" : "false"),
  };
}

export function ServiceForm({
  action,
  initialValues,
  isEdit = false,
}: {
  action: (
    prevState: ServiceFormState,
    formData: FormData,
  ) => Promise<ServiceFormState>;
  initialValues?: ServiceInitialValues;
  isEdit?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState(() =>
    initValues(undefined, initialValues),
  );

  // When the server returns new state (after error), sync form values.
  // React derived-state pattern — no useEffect needed.
  const [prevServerValues, setPrevServerValues] = useState(state.values);
  if (prevServerValues !== state.values && state.values) {
    setPrevServerValues(state.values);
    setFields(initValues(state.values, initialValues));
  }

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  const showDeposit = fields.requiresDeposit === "true";

  const hasAdvancedValues =
    Number(fields.bufferBeforeMinutes) > 0 ||
    Number(fields.bufferAfterMinutes) > 0 ||
    !!fields.categoryKey;
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedValues);

  const initialDuration = initialValues?.durationMinutes;
  const isCustomDuration =
    initialDuration !== undefined &&
    !DURATION_OPTIONS.some((o) => o.value === initialDuration);

  return (
    <form action={formAction} className="space-y-0" noValidate>
      {state.formError && (
        <div className="mb-6">
          <Alert>{state.formError}</Alert>
        </div>
      )}

      {/* Section 1 — Basic info */}
      <div className="space-y-5 pb-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {SERVICES.form.sectionBasic}
        </p>
        <Field
          label={SERVICES.form.nameLabel}
          htmlFor="name"
          error={state.errors?.name}
        >
          <Input
            id="name"
            name="name"
            placeholder={SERVICES.form.namePlaceholder}
            value={fields.name}
            onChange={(e) => set("name")(e.target.value)}
            autoFocus
          />
        </Field>
        <Field
          label={SERVICES.form.descriptionLabel}
          htmlFor="description"
        >
          <Textarea
            id="description"
            name="description"
            placeholder={SERVICES.form.descriptionPlaceholder}
            rows={3}
            value={fields.description}
            onChange={(e) => set("description")(e.target.value)}
          />
        </Field>
      </div>

      <div className="border-border border-t" />

      {/* Section 2 — Price and time */}
      <div className="space-y-5 py-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {SERVICES.form.sectionPriceAndTime}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={SERVICES.form.durationLabel}
            htmlFor="durationMinutes"
            hint={SERVICES.form.durationHint}
            error={state.errors?.durationMinutes}
          >
            <select
              id="durationMinutes"
              name="durationMinutes"
              value={fields.durationMinutes}
              onChange={(e) => set("durationMinutes")(e.target.value)}
              className={selectClass}
            >
              <option value="">{SERVICES.form.durationPlaceholder}</option>
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {isCustomDuration && (
                <option value={initialDuration}>
                  {initialDuration} דקות
                </option>
              )}
            </select>
          </Field>

          <Field
            label={SERVICES.form.priceLabel}
            htmlFor="price"
            error={state.errors?.price}
          >
            <div className="relative">
              <span className="text-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-base">
                ₪
              </span>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder={SERVICES.form.pricePlaceholder}
                value={fields.price}
                onChange={(e) => set("price")(e.target.value)}
                className="pr-10"
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="border-border border-t" />

      {/* Section 3 — Deposit */}
      <div className="space-y-4 py-6">
        <div>
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {SERVICES.form.sectionDeposit}
          </p>
          <p className="text-muted mt-1 text-xs leading-5">
            {SERVICES.form.depositHint}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="requiresDeposit"
            value="true"
            checked={showDeposit}
            onChange={(e) =>
              set("requiresDeposit")(e.target.checked ? "true" : "false")
            }
            className="h-5 w-5 rounded accent-primary"
          />
          <span className="text-foreground font-medium">
            {SERVICES.form.requiresDepositLabel}
          </span>
        </label>

        {showDeposit && (
          <Field
            label={SERVICES.form.depositAmountLabel}
            htmlFor="depositAmount"
            error={state.errors?.depositAmount}
          >
            <div className="relative">
              <span className="text-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-base">
                ₪
              </span>
              <Input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder={SERVICES.form.depositAmountPlaceholder}
                value={fields.depositAmount}
                onChange={(e) => set("depositAmount")(e.target.value)}
                className="pr-10"
              />
            </div>
          </Field>
        )}
      </div>

      <div className="border-border border-t" />

      {/* Section 4 — Advanced (collapsible) */}
      <div className="py-6">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-muted hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <span className="text-xs">{showAdvanced ? "▴" : "▾"}</span>
          <span>{SERVICES.form.sectionAdvanced}</span>
          <span className="text-xs font-normal opacity-70">
            ({SERVICES.form.advancedOptional})
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={SERVICES.form.bufferBeforeLabel}
                htmlFor="bufferBeforeMinutes"
                hint={SERVICES.form.bufferBeforeHint}
                error={state.errors?.bufferBeforeMinutes}
              >
                <Input
                  id="bufferBeforeMinutes"
                  name="bufferBeforeMinutes"
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  placeholder="0"
                  value={fields.bufferBeforeMinutes}
                  onChange={(e) => set("bufferBeforeMinutes")(e.target.value)}
                />
              </Field>

              <Field
                label={SERVICES.form.bufferAfterLabel}
                htmlFor="bufferAfterMinutes"
                hint={SERVICES.form.bufferAfterHint}
                error={state.errors?.bufferAfterMinutes}
              >
                <Input
                  id="bufferAfterMinutes"
                  name="bufferAfterMinutes"
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  placeholder="0"
                  value={fields.bufferAfterMinutes}
                  onChange={(e) => set("bufferAfterMinutes")(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label={SERVICES.form.categoryLabel}
              htmlFor="categoryKey"
              hint={SERVICES.form.categoryHint}
            >
              <select
                id="categoryKey"
                name="categoryKey"
                value={fields.categoryKey}
                onChange={(e) => set("categoryKey")(e.target.value)}
                className={selectClass}
              >
                <option value="">{SERVICES.form.categoryPlaceholder}</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            {isEdit && (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  checked={fields.isActive === "true"}
                  onChange={(e) =>
                    set("isActive")(e.target.checked ? "true" : "false")
                  }
                  className="h-5 w-5 rounded accent-primary"
                />
                <span className="text-foreground font-medium">
                  {SERVICES.form.isActiveLabel}
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Form actions */}
      <div className="border-border space-y-3 border-t pt-6">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? SERVICES.form.saving
            : isEdit
              ? SERVICES.form.saveEditButton
              : SERVICES.form.saveButton}
        </Button>
        <div className="text-center">
          <Link
            href="/services"
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            {SERVICES.form.backLink}
          </Link>
        </div>
      </div>
    </form>
  );
}
