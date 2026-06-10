"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Clock, CreditCard, Settings2, ToggleLeft, Save } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(184,107,140,0.10)" }}
        >
          <Icon className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {title}
          </p>
          {subtitle && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
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

  const [prevServerValues, setPrevServerValues] = useState(state.values);
  if (prevServerValues !== state.values && state.values) {
    setPrevServerValues(state.values);
    setFields(initValues(state.values, initialValues));
  }

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  const showDeposit = fields.requiresDeposit === "true";
  const isActive = fields.isActive === "true";

  const initialDuration = initialValues?.durationMinutes;
  const isCustomDuration =
    initialDuration !== undefined &&
    !DURATION_OPTIONS.some((o) => o.value === initialDuration);

  return (
    <form action={formAction} noValidate>
      {state.formError && (
        <div className="mb-5">
          <Alert>{state.formError}</Alert>
        </div>
      )}

      {/* 2-column card grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Card 1: Service details */}
        <SectionCard icon={FileText} title={SERVICES.form.sectionBasic} subtitle="שם השירות ותיאור קצר">
          <Field label={SERVICES.form.nameLabel} htmlFor="name" error={state.errors?.name}>
            <Input
              id="name"
              name="name"
              placeholder={SERVICES.form.namePlaceholder}
              value={fields.name}
              onChange={(e) => set("name")(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label={SERVICES.form.descriptionLabel} htmlFor="description">
            <Textarea
              id="description"
              name="description"
              placeholder={SERVICES.form.descriptionPlaceholder}
              rows={4}
              value={fields.description}
              onChange={(e) => set("description")(e.target.value)}
            />
            <p className="mt-1 text-right text-xs" style={{ color: "var(--muted)" }}>
              {fields.description.length}/180
            </p>
          </Field>
        </SectionCard>

        {/* Card 2: Price and duration */}
        <SectionCard icon={Clock} title={SERVICES.form.sectionPriceAndTime} subtitle="כמה זמן השירות נמשך בפועל">
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
                <option value={initialDuration}>{initialDuration} דקות</option>
              )}
            </select>
          </Field>

          <Field label={SERVICES.form.priceLabel} htmlFor="price" error={state.errors?.price}>
            <div className="relative">
              <span
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-base"
                style={{ color: "var(--muted)" }}
              >
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
        </SectionCard>

        {/* Card 3: Deposit */}
        <SectionCard
          icon={CreditCard}
          title={SERVICES.form.sectionDeposit}
          subtitle="ניתן לגבות מקדמה בין 10₪ ל-500₪"
        >
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="requiresDeposit"
              value="true"
              checked={showDeposit}
              onChange={(e) => set("requiresDeposit")(e.target.checked ? "true" : "false")}
              className="h-5 w-5 rounded accent-primary"
            />
            <span className="text-foreground font-medium text-sm">
              {SERVICES.form.requiresDepositLabel}
            </span>
          </label>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {SERVICES.form.depositHint}
          </p>

          {showDeposit && (
            <Field
              label={SERVICES.form.depositAmountLabel}
              htmlFor="depositAmount"
              error={state.errors?.depositAmount}
            >
              <div className="relative">
                <span
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-base"
                  style={{ color: "var(--muted)" }}
                >
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
        </SectionCard>

        {/* Card 4: Advanced settings */}
        <SectionCard
          icon={Settings2}
          title={SERVICES.form.sectionAdvanced}
          subtitle={`${SERVICES.form.advancedOptional} — אפשר להשאיר ריק לשייר במשך`}
        >
          <div className="grid grid-cols-2 gap-3">
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
        </SectionCard>
      </div>

      {/* Full-width: Active status toggle */}
      {isEdit && (
        <div
          className="mt-4 flex items-center justify-between rounded-2xl p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(184,107,140,0.10)" }}
            >
              <ToggleLeft className="h-4 w-4" style={{ color: "#b86b8c" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                סטטוס השירות
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                הגדרי אם השירות פעיל וגלוי ללקוחות
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>
              {isActive ? "פעיל" : "לא פעיל"}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                checked={isActive}
                onChange={(e) => set("isActive")(e.target.checked ? "true" : "false")}
                className="sr-only"
              />
              <div
                className="h-6 w-11 rounded-full transition-colors"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)"
                    : "rgba(43,37,48,0.15)",
                }}
                onClick={() => set("isActive")(isActive ? "false" : "true")}
              >
                <div
                  className="mt-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
                  style={{
                    marginRight: isActive ? "0.125rem" : "1.375rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  }}
                />
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 flex items-center justify-end gap-3">
        <Link
          href="/services"
          className="flex h-11 cursor-pointer items-center rounded-xl border px-5 text-sm font-medium transition-all hover:shadow-sm"
          style={{
            borderColor: "var(--border)",
            color: "var(--foreground-soft)",
            background: "var(--surface)",
          }}
        >
          ✕ ביטול
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(184,107,140,0.30)",
          }}
        >
          <Save className="h-4 w-4" />
          {isPending
            ? SERVICES.form.saving
            : isEdit
            ? SERVICES.form.saveEditButton
            : SERVICES.form.saveButton}
        </button>
      </div>

      {/* Security note */}
      <p className="mt-3 text-center text-xs" style={{ color: "var(--muted)" }}>
        ✓ השינויים יישמרו באופן מאובטח
      </p>
    </form>
  );
}
