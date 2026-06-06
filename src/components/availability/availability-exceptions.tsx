"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { TimeSelect } from "@/components/availability/time-select";
import { AVAILABILITY, ACTIONS } from "@/lib/constants/he";
import { minutesToTime } from "@/lib/time";
import {
  addExceptionAction,
  deleteExceptionAction,
  type ExceptionFormState,
} from "@/server/availability/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExceptionRecord {
  id: string;
  /** ISO date string (YYYY-MM-DD) — serialisable from server component. */
  date: string;
  type: "closed" | "custom_hours";
  startMinutes: number | null;
  endMinutes: number | null;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "bg-surface border-border text-foreground h-11 w-full rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary";

const selectClass =
  "bg-surface border-border text-foreground h-11 w-full rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Single exception row
// ---------------------------------------------------------------------------

function ExceptionRow({ ex }: { ex: ExceptionRecord }) {
  const deleteWithId = deleteExceptionAction.bind(null, ex.id);

  const typeDetail =
    ex.type === "closed"
      ? AVAILABILITY.exceptions.typeClosed
      : `${minutesToTime(ex.startMinutes!)}–${minutesToTime(ex.endMinutes!)}`;

  return (
    <li className="border-border flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium">
          {formatDate(ex.date)} — {typeDetail}
        </span>
        {ex.reason && (
          <span className="text-muted text-xs">{ex.reason}</span>
        )}
      </div>
      <form action={deleteWithId}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
        >
          {AVAILABILITY.exceptions.deleteButton}
        </Button>
      </form>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add exception form (inline)
// ---------------------------------------------------------------------------

function AddExceptionForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<
    ExceptionFormState,
    FormData
  >(addExceptionAction, {});

  const [fields, setFields] = useState({
    date: "",
    type: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  // Sync from server state after validation error
  const [prevServerValues, setPrevServerValues] = useState(state.values);
  if (prevServerValues !== state.values && state.values) {
    setPrevServerValues(state.values);
    setFields((prev) => ({
      date: state.values?.date ?? prev.date,
      type: state.values?.type ?? prev.type,
      startTime: state.values?.startTime ?? prev.startTime,
      endTime: state.values?.endTime ?? prev.endTime,
      reason: state.values?.reason ?? prev.reason,
    }));
  }

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  // Close automatically on success
  const [prevSuccess, setPrevSuccess] = useState(false);
  if (state.success && !prevSuccess) {
    setPrevSuccess(true);
    setTimeout(onClose, 0);
  }

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-xl border border-border p-3"
    >
      {state.formError && (
        <Alert variant="error">{state.formError}</Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Date */}
        <Field
          label={AVAILABILITY.exceptions.dateLabel}
          htmlFor="exc-date"
          error={state.errors?.date}
          hint={AVAILABILITY.exceptions.dateHint}
        >
          <input
            id="exc-date"
            name="date"
            type="date"
            value={fields.date}
            onChange={(e) => set("date")(e.target.value)}
            className={`${inputClass} ${state.errors?.date ? "border-red-400" : ""}`}
          />
        </Field>

        {/* Type */}
        <Field
          label={AVAILABILITY.exceptions.typeLabel}
          htmlFor="exc-type"
          error={state.errors?.type}
        >
          <select
            id="exc-type"
            name="type"
            value={fields.type}
            onChange={(e) => set("type")(e.target.value)}
            className={`${selectClass} ${state.errors?.type ? "border-red-400" : ""}`}
          >
            <option value="">בחירה…</option>
            <option value="closed">{AVAILABILITY.exceptions.typeClosed}</option>
            <option value="custom_hours">
              {AVAILABILITY.exceptions.typeCustomHours}
            </option>
          </select>
        </Field>
      </div>

      {/* Time selects — only for custom_hours */}
      {fields.type === "custom_hours" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={AVAILABILITY.exceptions.startTime}
            htmlFor="exc-start"
            error={state.errors?.startTime}
          >
            <TimeSelect
              id="exc-start"
              name="startTime"
              value={fields.startTime}
              onChange={set("startTime")}
              hasError={!!state.errors?.startTime}
              className="h-11 w-full"
            />
          </Field>
          <Field
            label={AVAILABILITY.exceptions.endTime}
            htmlFor="exc-end"
            error={state.errors?.endTime}
          >
            <TimeSelect
              id="exc-end"
              name="endTime"
              value={fields.endTime}
              onChange={set("endTime")}
              hasError={!!state.errors?.endTime}
              className="h-11 w-full"
            />
          </Field>
        </div>
      )}

      {/* Reason (optional) */}
      <Field
        label={`${AVAILABILITY.exceptions.reasonLabel} (${AVAILABILITY.exceptions.reasonOptional})`}
        htmlFor="exc-reason"
      >
        <input
          id="exc-reason"
          name="reason"
          type="text"
          placeholder={AVAILABILITY.exceptions.reasonPlaceholder}
          value={fields.reason}
          onChange={(e) => set("reason")(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending
            ? AVAILABILITY.exceptions.adding
            : AVAILABILITY.exceptions.addButton}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {ACTIONS.cancel}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AvailabilityExceptions({
  exceptions,
}: {
  exceptions: ExceptionRecord[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground font-bold">
            {AVAILABILITY.exceptions.title}
          </h2>
          <p className="text-muted mt-1 text-sm">
            {AVAILABILITY.exceptions.subtitle}
          </p>
        </div>
        {!showAddForm && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            {AVAILABILITY.exceptions.addButton}
          </Button>
        )}
      </div>

      {/* Exception list */}
      {exceptions.length > 0 ? (
        <ul>
          {exceptions.map((ex) => (
            <ExceptionRow key={ex.id} ex={ex} />
          ))}
        </ul>
      ) : (
        !showAddForm && (
          <p className="text-muted py-4 text-center text-sm">
            {AVAILABILITY.exceptions.noExceptions}
          </p>
        )
      )}

      {/* Add form */}
      {showAddForm && (
        <AddExceptionForm onClose={() => setShowAddForm(false)} />
      )}
    </Card>
  );
}
