"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Clock, Settings2, ToggleLeft, Save, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SERVICES } from "@/lib/constants/he";
import type { ServiceFormState } from "@/server/services/actions";

export interface ServiceInitialValues {
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: string;
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

/** Brand medallion used by every card header, mirroring BeautyPageHero's chip. */
export function SectionMedallion({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span
      className="ring-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      style={{
        background: "var(--brand-gradient)",
        boxShadow: "0 8px 18px -8px rgba(172,92,127,0.55)",
      }}
    >
      <Icon className="h-4 w-4 text-white" />
    </span>
  );
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
    <div className="aura-card flex h-full flex-col rounded-[1.5rem] p-6">
      <div className="mb-5 flex items-center gap-3">
        <SectionMedallion icon={Icon} />
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--muted)" }}>
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
  pricingHealth,
}: {
  action: (
    prevState: ServiceFormState,
    formData: FormData,
  ) => Promise<ServiceFormState>;
  initialValues?: ServiceInitialValues;
  isEdit?: boolean;
  /**
   * Pricing-health card slot. Rendered immediately after "מחיר וזמן" so the
   * most valuable pricing insight sits high in the page hierarchy (side-by-side
   * on desktop, directly below the price on mobile).
   */
  pricingHealth?: React.ReactNode;
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

  const isActive = fields.isActive === "true";

  const initialDuration = initialValues?.durationMinutes;
  const isCustomDuration =
    initialDuration !== undefined &&
    !DURATION_OPTIONS.some((o) => o.value === initialDuration);

  const detailsCard = (
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
        <p className="mt-1 text-left text-xs tabular-nums" style={{ color: "var(--muted)" }}>
          {fields.description.length}/180
        </p>
      </Field>
    </SectionCard>
  );

  const priceCard = (
    <SectionCard
      icon={Clock}
      title={SERVICES.form.sectionPriceAndTime}
      subtitle="כמה זמן הטיפול נמשך וכמה הוא עולה"
    >
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
  );

  const advancedCard = (
    <SectionCard
      icon={Settings2}
      title={SERVICES.form.sectionAdvanced}
      subtitle={`${SERVICES.form.advancedOptional} — אפשר להשאיר ריק`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>
    </SectionCard>
  );

  /*
    Card order. Create: details → price (the natural authoring order, and the
    autofocused name field comes first). Edit: price → pricing health → details,
    so the pricing insight sits beside the price it refers to.
    "Advanced" always closes the form full-width, which also guarantees an even
    number of half-width cards — no empty grid cell is ever left behind.
  */
  const halfCards = isEdit
    ? [priceCard, pricingHealth, detailsCard]
    : [detailsCard, priceCard];
  const cards = halfCards.filter(Boolean);

  return (
    <form action={formAction} noValidate>
      {state.formError && (
        <div className="mb-5">
          <Alert>{state.formError}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {cards.map((card, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col",
              // odd card out spans the full row so no half-empty cell remains
              cards.length % 2 === 1 && i === cards.length - 1 && "md:col-span-2",
            )}
          >
            {card}
          </div>
        ))}

        <div className="md:col-span-2">{advancedCard}</div>

        {/* Active status toggle — edit only */}
        {isEdit && (
          <div className="aura-card flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] p-6 md:col-span-2">
            <div className="flex items-center gap-3">
              <SectionMedallion icon={ToggleLeft} />
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  סטטוס השירות
                </p>
                <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--muted)" }}>
                  הגדירי אם השירות פעיל וגלוי ללקוחות
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
              <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                {isActive ? "פעיל" : "לא פעיל"}
              </span>
              <Switch
                checked={isActive}
                onCheckedChange={(v) => set("isActive")(v ? "true" : "false")}
                aria-label="סטטוס השירות"
              />
            </div>
          </div>
        )}

        {/* Footer bar — same card language as the sections above */}
        <div className="aura-card flex flex-col gap-4 rounded-[1.5rem] p-5 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
          <p
            className="flex items-center gap-1.5 text-xs leading-5"
            style={{ color: "var(--muted)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            השינויים נשמרים באופן מאובטח
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/services"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }), "text-sm")}
            >
              ביטול
            </Link>
            <Button type="submit" disabled={isPending} className="text-sm font-semibold">
              <Save className="h-4 w-4" />
              {isPending
                ? SERVICES.form.saving
                : isEdit
                  ? SERVICES.form.saveEditButton
                  : SERVICES.form.saveButton}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
