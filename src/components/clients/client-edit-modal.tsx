"use client";

import { useState, useEffect, useActionState } from "react";
import { Pencil, X } from "lucide-react";
import { updateClientAction } from "@/server/clients/actions";
import type { UpdateClientState } from "@/server/clients/actions";
import { CLIENTS } from "@/lib/constants/he";

const c = CLIENTS.edit;

export interface ClientEditInitialData {
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  isUnsubscribed: boolean;
}

interface Props {
  clientId: string;
  initialData: ClientEditInitialData;
}

const initialState: UpdateClientState = {};

export function ClientEditModal({ clientId, initialData }: Props) {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState(0);

  const boundAction = updateClientAction.bind(null, clientId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  const handleOpen = () => {
    setOpenKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm"
        style={{
          borderColor: "var(--border)",
          color: "var(--foreground-soft)",
          background: "var(--surface)",
        }}
      >
        <Pencil className="h-3 w-3" />
        {c.openButton}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div
              className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh]"
              style={{ background: "var(--surface)" }}
            >
              {/* Header */}
              <div
                className="flex shrink-0 items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h2
                  className="text-base font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {c.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 transition-opacity hover:opacity-70"
                  style={{ color: "var(--muted)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <form key={openKey} action={formAction} className="p-5 space-y-4">
                  {/* Form error */}
                  {state.formError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {state.formError}
                    </p>
                  )}

                  {/* Full name */}
                  <div className="space-y-1">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {c.fields.fullName}
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      defaultValue={initialData.fullName}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.fullName
                          ? "#dc2626"
                          : "var(--border)",
                        background: "var(--background-alt)",
                        color: "var(--foreground)",
                      }}
                    />
                    {state.fieldErrors?.fullName && (
                      <p className="text-xs text-red-600">
                        {state.fieldErrors.fullName}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {c.fields.phone}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      dir="ltr"
                      defaultValue={initialData.phone}
                      placeholder={c.fields.phonePlaceholder}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.phone
                          ? "#dc2626"
                          : "var(--border)",
                        background: "var(--background-alt)",
                        color: "var(--foreground)",
                        textAlign: "left",
                      }}
                    />
                    {state.fieldErrors?.phone && (
                      <p className="text-xs text-red-600">
                        {state.fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {c.fields.email}
                    </label>
                    <input
                      type="email"
                      name="email"
                      dir="ltr"
                      defaultValue={initialData.email ?? ""}
                      placeholder={c.fields.emailPlaceholder}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.email
                          ? "#dc2626"
                          : "var(--border)",
                        background: "var(--background-alt)",
                        color: "var(--foreground)",
                        textAlign: "left",
                      }}
                    />
                    {state.fieldErrors?.email && (
                      <p className="text-xs text-red-600">
                        {state.fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {c.fields.notes}
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={initialData.notes ?? ""}
                      placeholder={c.fields.notesPlaceholder}
                      className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--background-alt)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>

                  {/* Checkboxes */}
                  <div
                    className="space-y-2 rounded-xl p-3"
                    style={{ background: "var(--background-alt)" }}
                  >
                    <CheckboxRow
                      name="whatsappOptIn"
                      label={c.fields.whatsappOptIn}
                      defaultChecked={initialData.whatsappOptIn}
                      color="#16a34a"
                    />
                    <CheckboxRow
                      name="marketingOptIn"
                      label={c.fields.marketingOptIn}
                      defaultChecked={initialData.marketingOptIn}
                      color="#3b7ab5"
                    />
                  </div>

                  {/* Read-only unsubscribe notice */}
                  {initialData.isUnsubscribed && (
                    <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                      {c.fields.unsubscribedNotice}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{
                        color: "var(--muted)",
                        background: "var(--background-alt)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {c.cancelButton}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{
                        background:
                          "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
                      }}
                    >
                      {isPending ? c.savingButton : c.saveButton}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function CheckboxRow({
  name,
  label,
  defaultChecked,
  color,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  color: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded"
        style={{ accentColor: color }}
      />
      <span
        className="text-sm leading-5"
        style={{ color: "var(--foreground-soft)" }}
      >
        {label}
      </span>
    </label>
  );
}
