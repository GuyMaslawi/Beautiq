"use client";

import { useState, useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TimeSelect } from "@/components/availability/time-select";
import { AVAILABILITY } from "@/lib/constants/he";
import { minutesToTime } from "@/lib/time";
import {
  saveWeeklyAvailabilityAction,
  type WeeklyFormState,
} from "@/server/availability/actions";
import type { DayFieldErrors } from "@/lib/validation/availability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayConfig {
  isOpen: boolean;
  start: string;
  end: string;
}

interface InitialRule {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

function buildSummary(rules: InitialRule[]): string {
  if (rules.length === 0) return "";
  const sorted = [...rules].sort((a, b) => a.weekday - b.weekday);
  const groups: { days: number[]; startMinutes: number; endMinutes: number }[] = [];
  for (const rule of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.startMinutes === rule.startMinutes &&
      last.endMinutes === rule.endMinutes &&
      rule.weekday === last.days[last.days.length - 1] + 1
    ) {
      last.days.push(rule.weekday);
    } else {
      groups.push({ days: [rule.weekday], startMinutes: rule.startMinutes, endMinutes: rule.endMinutes });
    }
  }
  return groups
    .map((g) => {
      const first = AVAILABILITY.days[g.days[0]];
      const last = AVAILABILITY.days[g.days[g.days.length - 1]];
      const dayStr = g.days.length > 1 ? `${first}–${last}` : first;
      return `${dayStr} ${minutesToTime(g.startMinutes)}–${minutesToTime(g.endMinutes)}`;
    })
    .join(" · ");
}

function initDays(rules: InitialRule[]): DayConfig[] {
  const days: DayConfig[] = Array.from({ length: 7 }, () => ({
    isOpen: false,
    start: "",
    end: "",
  }));
  rules.forEach(({ weekday, startMinutes, endMinutes }) => {
    days[weekday] = {
      isOpen: true,
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
    };
  });
  return days;
}

// Preset builders
function makeSunThru(start: string, end: string): DayConfig[] {
  return Array.from({ length: 7 }, (_, i) =>
    i <= 4
      ? { isOpen: true, start, end }
      : { isOpen: false, start: "", end: "" },
  );
}

function makeWithFriday(): DayConfig[] {
  const days = makeSunThru("09:00", "17:00");
  days[5] = { isOpen: true, start: "09:00", end: "13:00" };
  return days;
}

function makeClearAll(): DayConfig[] {
  return Array.from({ length: 7 }, () => ({
    isOpen: false,
    start: "",
    end: "",
  }));
}

// ---------------------------------------------------------------------------
// Day row sub-component
// ---------------------------------------------------------------------------

function DayRow({
  weekday,
  dayName,
  config,
  errors,
  onToggle,
  onTimeChange,
}: {
  weekday: number;
  dayName: string;
  config: DayConfig;
  errors?: DayFieldErrors;
  onToggle: () => void;
  onTimeChange: (field: "start" | "end", value: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        config.isOpen
          ? "border-border bg-surface shadow-sm"
          : "border-border/60 bg-surface"
      }`}
    >
      {/* Toggle row: toggle + name + status badge */}
      <div className="flex items-center gap-3">
        {/* Hidden input carries the open/closed state for form submission */}
        <input
          type="hidden"
          name={`day_${weekday}_open`}
          value={config.isOpen ? "true" : "false"}
        />
        {/* Physical left/right used intentionally — toggles are direction-neutral */}
        <button
          type="button"
          role="switch"
          aria-checked={config.isOpen}
          aria-label={`${dayName} — ${config.isOpen ? AVAILABILITY.weekly.open : AVAILABILITY.weekly.closed}`}
          onClick={onToggle}
          className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            config.isOpen ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
              config.isOpen ? "left-6" : "left-1"
            }`}
          />
        </button>

        <span
          className={`min-w-[3.5rem] text-sm font-semibold ${
            config.isOpen ? "text-foreground" : "text-muted"
          }`}
        >
          {dayName}
        </span>

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            config.isOpen
              ? "bg-green-100 text-green-700"
              : "bg-muted/20 text-muted"
          }`}
        >
          {config.isOpen ? AVAILABILITY.weekly.open : AVAILABILITY.weekly.closed}
        </span>
      </div>

      {/* Content row: time selects (open) or closed note */}
      {config.isOpen ? (
        <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2 ps-14">
          {/* Start time */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`day_${weekday}_start`}
              className="text-muted text-xs"
            >
              {AVAILABILITY.weekly.startTime}
            </label>
            <TimeSelect
              id={`day_${weekday}_start`}
              name={`day_${weekday}_start`}
              value={config.start}
              onChange={(v) => onTimeChange("start", v)}
              hasError={!!errors?.startTime}
            />
            {errors?.startTime && (
              <p className="text-xs text-red-600">{errors.startTime}</p>
            )}
          </div>

          {/* End time */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`day_${weekday}_end`}
              className="text-muted text-xs"
            >
              {AVAILABILITY.weekly.endTime}
            </label>
            <TimeSelect
              id={`day_${weekday}_end`}
              name={`day_${weekday}_end`}
              value={config.end}
              onChange={(v) => onTimeChange("end", v)}
              hasError={!!errors?.endTime}
            />
            {errors?.endTime && (
              <p className="text-xs text-red-600">{errors.endTime}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-muted mt-2 ps-14 text-xs">
          {AVAILABILITY.weekly.closedDayNote}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WeeklyAvailabilityForm({
  initialRules,
}: {
  initialRules: InitialRule[];
}) {
  const [days, setDays] = useState<DayConfig[]>(() => initDays(initialRules));
  const [isDirty, setIsDirty] = useState(false);
  const [state, formAction, isPending] = useActionState<
    WeeklyFormState,
    FormData
  >(saveWeeklyAvailabilityAction, {});

  // Reset dirty flag as soon as the action returns success (setState-in-render pattern)
  const [prevSuccess, setPrevSuccess] = useState(false);
  if (state.success && !prevSuccess) {
    setPrevSuccess(true);
    setIsDirty(false);
  }
  if (!state.success && prevSuccess) {
    setPrevSuccess(false);
  }

  function toggleDay(i: number) {
    setDays((prev) => {
      const next = [...prev];
      const current = next[i];
      next[i] = current.isOpen
        ? { ...current, isOpen: false }
        : {
            isOpen: true,
            start: current.start || DEFAULT_START,
            end: current.end || DEFAULT_END,
          };
      return next;
    });
    setIsDirty(true);
  }

  function updateTime(i: number, field: "start" | "end", value: string) {
    setDays((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
    setIsDirty(true);
  }

  function applyPreset(preset: DayConfig[]) {
    setDays(preset);
    setIsDirty(true);
  }

  const savedSummary = buildSummary(initialRules);

  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-foreground font-bold">{AVAILABILITY.weekly.title}</h2>
        <p className="text-muted mt-1 text-sm">{AVAILABILITY.weekly.subtitle}</p>
      </div>

      {/* Saved summary */}
      <div className="border-border mb-5 border-b pb-4">
        <p className="text-muted text-xs font-medium">
          {AVAILABILITY.weekly.summary.heading}
        </p>
        <p className={`mt-1 text-sm ${savedSummary ? "text-foreground" : "text-muted"}`}>
          {savedSummary || AVAILABILITY.weekly.summary.empty}
        </p>
      </div>

      {/* Quick presets */}
      <div className="mb-5 space-y-2">
        <p className="text-muted text-xs">{AVAILABILITY.weekly.presets.hint}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset(makeSunThru("09:00", "17:00"))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {AVAILABILITY.weekly.presets.sunThu9to17}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(makeSunThru("10:00", "19:00"))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {AVAILABILITY.weekly.presets.sunThu10to19}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(makeWithFriday())}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {AVAILABILITY.weekly.presets.withFriday}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(makeClearAll())}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border hover:text-foreground"
          >
            {AVAILABILITY.weekly.presets.clearAll}
          </button>
        </div>
      </div>

      {/* Form */}
      <form action={formAction} className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => (
          <DayRow
            key={i}
            weekday={i}
            dayName={AVAILABILITY.days[i]}
            config={days[i]}
            errors={state.dayErrors?.[i]}
            onToggle={() => toggleDay(i)}
            onTimeChange={(field, value) => updateTime(i, field, value)}
          />
        ))}

        {state.formError && (
          <Alert variant="error" className="mt-4">
            {state.formError}
          </Alert>
        )}

        {state.success && (
          <Alert variant="success" className="mt-4">
            {AVAILABILITY.weekly.success}
          </Alert>
        )}

        <div className="flex items-center gap-4 pt-3">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? AVAILABILITY.weekly.saving
              : AVAILABILITY.weekly.saveButton}
          </Button>
          {isDirty && !isPending && (
            <span className="text-muted text-xs">
              {AVAILABILITY.weekly.unsavedChanges}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
