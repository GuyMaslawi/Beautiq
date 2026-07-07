"use client";

import { useActionState, useRef, useState } from "react";
import { AUTOMATIONS } from "@/lib/constants/he";
import type { ReminderSettings } from "@/server/automations/queries";
import { saveReminderSettingsAction } from "@/server/automations/actions";
import type { ReminderSettingsFormState } from "@/server/automations/actions";

const PRESET_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 24, label: AUTOMATIONS.reminders.settings.timing24 },
  { value: 12, label: AUTOMATIONS.reminders.settings.timing12 },
  { value: 3, label: AUTOMATIONS.reminders.settings.timing3 },
  { value: 1, label: AUTOMATIONS.reminders.settings.timing1 },
];

const VARIABLE_CHIPS = AUTOMATIONS.reminders.settings.variableChips;

const initialState: ReminderSettingsFormState = {};

export function ReminderSettingsForm({
  settings,
}: {
  settings: ReminderSettings;
}) {
  const [state, formAction, isPending] = useActionState(
    saveReminderSettingsAction,
    initialState,
  );

  const isPreset = PRESET_OPTIONS.some(
    (o) => o.value === settings.reminderHoursBefore,
  );
  const [selectedHours, setSelectedHours] = useState<number>(
    settings.reminderHoursBefore,
  );
  const [isCustom, setIsCustom] = useState(!isPreset);
  const [template, setTemplate] = useState(settings.reminderTemplate);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const el = textareaRef.current;
    if (!el) {
      setTemplate((t) => t + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = template.slice(0, start) + variable + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  const c = AUTOMATIONS.reminders.settings;

  return (
    <form action={formAction}>
      {/* Hidden field for hours */}
      <input
        type="hidden"
        name="reminderHoursBefore"
        value={String(selectedHours)}
      />

      <div className="space-y-5">
        {/* Timing presets */}
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {c.timingLabel}
          </label>
          <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
            {c.timingHelper}
          </p>

          <div className="flex flex-wrap gap-2">
            {PRESET_OPTIONS.map((opt) => {
              const active = !isCustom && selectedHours === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSelectedHours(opt.value);
                    setIsCustom(false);
                  }}
                  className="rounded-full px-4 py-2 text-sm font-medium transition-all"
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(172,92,127,0.30)",
                        }
                      : {
                          background: "var(--background-alt)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground-soft)",
                        }
                  }
                >
                  {opt.label}
                </button>
              );
            })}

            {/* Custom */}
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-all"
              style={
                isCustom
                  ? {
                      background:
                        "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
                      color: "#fff",
                      boxShadow: "0 2px 8px rgba(172,92,127,0.30)",
                    }
                  : {
                      background: "var(--background-alt)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground-soft)",
                    }
              }
            >
              {c.timingCustom}
            </button>
          </div>

          {isCustom && (
            <div className="mt-3 flex items-center gap-3">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--foreground-soft)" }}
              >
                {c.customHoursLabel}
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={selectedHours}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setSelectedHours(v);
                }}
                placeholder={c.customHoursPlaceholder}
                className="w-24 rounded-xl border px-3 py-2 text-sm"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          )}
        </div>

        {/* Template */}
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {c.templateLabel}
          </label>

          {/* Variable chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {c.availableVariables}
            </span>
            {VARIABLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => insertVariable(chip)}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(172,92,127,0.10)",
                  color: "#ac5c7f",
                  border: "1px solid rgba(172,92,127,0.20)",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            name="reminderTemplate"
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={c.templatePlaceholder}
            className="w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontFamily: "inherit",
              direction: "rtl",
            }}
          />
        </div>

        {/* Save button + feedback */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
              boxShadow: "0 2px 8px rgba(172,92,127,0.28)",
            }}
          >
            {isPending ? c.saving : c.saveButton}
          </button>

          {state.success && (
            <p className="text-sm font-medium" style={{ color: "#3d8b6e" }}>
              {state.success}
            </p>
          )}
          {state.error && (
            <p className="text-sm font-medium" style={{ color: "#be4a4a" }}>
              {state.error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
