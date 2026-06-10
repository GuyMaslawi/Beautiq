"use client";

import { useActionState, useState } from "react";
import {
  submitPublicBookingAction,
  type PublicBookingFormState,
} from "@/server/public-booking/actions";
import type { PublicService, PublicCancellationPolicy } from "@/server/public-booking/queries";
import { PUBLIC_BOOKING } from "@/lib/constants/he";

// ---------------------------------------------------------------------------
// Today's date in YYYY-MM-DD (client-side, for date input min)
// ---------------------------------------------------------------------------
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-[var(--foreground)]"
    >
      {children}
      {optional && (
        <span className="mr-1 text-xs font-normal text-[var(--muted)]">
          ({PUBLIC_BOOKING.form.noteOptional})
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

// ---------------------------------------------------------------------------
// Success view
// ---------------------------------------------------------------------------

function SuccessView({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center space-y-4">
      <div className="flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10 text-2xl">
          ✓
        </span>
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--foreground)]">
          {PUBLIC_BOOKING.success.title}
        </h2>
        <p className="text-sm text-[var(--muted)]">{PUBLIC_BOOKING.success.body}</p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="text-sm font-medium text-[var(--primary)] underline underline-offset-2"
      >
        {PUBLIC_BOOKING.success.sendAnother}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function BookingRequestForm({
  slug,
  services,
  cancellationPolicy,
  showPrices = true,
}: {
  slug: string;
  services: PublicService[];
  cancellationPolicy: PublicCancellationPolicy | null;
  showPrices?: boolean;
}) {
  const boundAction = submitPublicBookingAction.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    PublicBookingFormState,
    FormData
  >(boundAction, {});

  const [selectedServiceId, setSelectedServiceId] = useState(
    state.values?.serviceId ?? "",
  );
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  if (state.success) {
    return <SuccessView onReset={() => window.location.reload()} />;
  }

  const v = state.values ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Global error */}
      {state.formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.formError}
        </div>
      )}

      {/* Section: Service */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 space-y-4">
        <h2 className="font-bold text-[var(--foreground)]">
          {PUBLIC_BOOKING.form.sectionService}
        </h2>

        <div>
          <Label htmlFor="serviceId">{PUBLIC_BOOKING.form.serviceLabel}</Label>
          <select
            id="serviceId"
            name="serviceId"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className={inputClass}
            aria-invalid={!!state.errors?.serviceId}
          >
            <option value="">{PUBLIC_BOOKING.form.servicePlaceholder}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMinutes}{" "}
                {PUBLIC_BOOKING.form.serviceDurationSuffix}
                {showPrices
                  ? ` · ${PUBLIC_BOOKING.form.servicePricePrefix}${Number(s.price).toLocaleString("he-IL")}`
                  : ""}
              </option>
            ))}
          </select>
          <FieldError message={state.errors?.serviceId} />
        </div>

        {selectedService?.requiresDeposit && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
            {PUBLIC_BOOKING.form.depositNote}
          </p>
        )}
      </div>

      {/* Section: Client details */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 space-y-4">
        <h2 className="font-bold text-[var(--foreground)]">
          {PUBLIC_BOOKING.form.sectionClient}
        </h2>

        <div>
          <Label htmlFor="clientName">
            {PUBLIC_BOOKING.form.clientNameLabel}
          </Label>
          <input
            id="clientName"
            name="clientName"
            type="text"
            autoComplete="name"
            placeholder={PUBLIC_BOOKING.form.clientNamePlaceholder}
            defaultValue={v.clientName}
            className={inputClass}
            aria-invalid={!!state.errors?.clientName}
          />
          <FieldError message={state.errors?.clientName} />
        </div>

        <div>
          <Label htmlFor="phone">{PUBLIC_BOOKING.form.phoneLabel}</Label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={PUBLIC_BOOKING.form.phonePlaceholder}
            defaultValue={v.phone}
            className={inputClass}
            dir="ltr"
            aria-invalid={!!state.errors?.phone}
          />
          <FieldError message={state.errors?.phone} />
        </div>

        <div>
          <Label htmlFor="note" optional>
            {PUBLIC_BOOKING.form.noteLabel}
          </Label>
          <textarea
            id="note"
            name="note"
            rows={3}
            placeholder={PUBLIC_BOOKING.form.notePlaceholder}
            defaultValue={v.note}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* Section: Date & time */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 space-y-4">
        <h2 className="font-bold text-[var(--foreground)]">
          {PUBLIC_BOOKING.form.sectionDateTime}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">{PUBLIC_BOOKING.form.dateLabel}</Label>
            <input
              id="date"
              name="date"
              type="date"
              min={todayISO()}
              defaultValue={v.date}
              className={inputClass}
              aria-invalid={!!state.errors?.date}
            />
            <FieldError message={state.errors?.date} />
          </div>

          <div>
            <Label htmlFor="requestedTime">{PUBLIC_BOOKING.form.timeLabel}</Label>
            <input
              id="requestedTime"
              name="requestedTime"
              type="time"
              defaultValue={v.requestedTime}
              className={inputClass}
              aria-invalid={!!state.errors?.requestedTime}
            />
            <FieldError message={state.errors?.requestedTime} />
          </div>
        </div>
      </div>

      {/* Cancellation policy — only shown when enabled */}
      {cancellationPolicy?.policyText && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 space-y-3">
          <h2 className="font-bold text-[var(--foreground)]">
            {PUBLIC_BOOKING.form.policyTitle}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
            {cancellationPolicy.policyText}
          </p>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={policyAcknowledged}
              onChange={(e) => setPolicyAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[var(--primary)]"
              required
            />
            <span className="text-sm" style={{ color: "var(--foreground-soft)" }}>
              {PUBLIC_BOOKING.form.policyAcknowledge}
            </span>
          </label>
        </div>
      )}

      {/* Approval note */}
      <p className="text-center text-xs text-[var(--muted)] leading-5">
        {PUBLIC_BOOKING.form.approvalNote}
      </p>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending || (!!cancellationPolicy?.policyText && !policyAcknowledged)}
        className="w-full rounded-2xl bg-[var(--primary)] py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? PUBLIC_BOOKING.form.submitting
          : PUBLIC_BOOKING.form.submitButton}
      </button>
    </form>
  );
}
