"use client";

import { useActionState, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import {
  createWaitlistEntryAction,
  type WaitlistFormState,
} from "@/server/waitlist/actions";
import { WAITLIST } from "@/lib/constants/he";

const INITIAL: WaitlistFormState = {};

const selectClass =
  "bg-surface border-border text-foreground h-11 w-full appearance-none rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary";

export function WaitlistAddForm({
  services,
}: {
  services: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createWaitlistEntryAction,
    INITIAL,
  );
  // Track the last success we collapsed for. Adjusting state during render (the
  // React-recommended alternative to an effect) lets us auto-collapse the form
  // once a new submit succeeds, without a setState-in-effect. The form is
  // conditionally mounted, so collapsing also clears its inputs on remount.
  const [collapsedFor, setCollapsedFor] = useState<string | null>(null);

  if (state.success && state.nonce && state.nonce !== collapsedFor) {
    setCollapsedFor(state.nonce);
    setOpen(false);
  }

  // Show the confirmation while the form is collapsed after a successful add.
  const showSuccess = !!state.success && !open && state.nonce === collapsedFor;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        {showSuccess ? (
          <div
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "#15803d" }}
          >
            <Check className="h-4 w-4" />
            {WAITLIST.form.successAdded}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? WAITLIST.actions.closeMessage : WAITLIST.actions.add}
        </button>
      </div>

      {open && (
        <form
          action={formAction}
          noValidate
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            {WAITLIST.form.title}
          </p>

          {state.formError && <Alert>{state.formError}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={WAITLIST.form.clientName}
              htmlFor="clientName"
              error={state.errors?.clientName}
            >
              <Input
                id="clientName"
                name="clientName"
                placeholder={WAITLIST.form.clientNamePlaceholder}
                defaultValue={state.values?.clientName}
              />
            </Field>
            <Field
              label={WAITLIST.form.phone}
              htmlFor="phone"
              error={state.errors?.phone}
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                placeholder={WAITLIST.form.phonePlaceholder}
                defaultValue={state.values?.phone}
              />
            </Field>
          </div>

          <Field label={WAITLIST.form.service} htmlFor="serviceId">
            <select
              id="serviceId"
              name="serviceId"
              defaultValue={state.values?.serviceId ?? ""}
              className={selectClass}
            >
              <option value="">{WAITLIST.form.servicePlaceholder}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={WAITLIST.form.preferredDate} htmlFor="preferredDate">
              <Input
                id="preferredDate"
                name="preferredDate"
                type="date"
                defaultValue={state.values?.preferredDate}
              />
            </Field>
            <Field label={WAITLIST.form.preferredFromTime} htmlFor="preferredFromTime">
              <Input
                id="preferredFromTime"
                name="preferredFromTime"
                type="time"
                defaultValue={state.values?.preferredFromTime}
              />
            </Field>
            <Field label={WAITLIST.form.preferredToTime} htmlFor="preferredToTime">
              <Input
                id="preferredToTime"
                name="preferredToTime"
                type="time"
                defaultValue={state.values?.preferredToTime}
              />
            </Field>
          </div>

          <Field label={WAITLIST.form.notes} htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder={WAITLIST.form.notesPlaceholder}
              defaultValue={state.values?.notes}
            />
          </Field>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)" }}
            >
              <Plus className="h-4 w-4" />
              {isPending ? WAITLIST.form.submitting : WAITLIST.form.submit}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
