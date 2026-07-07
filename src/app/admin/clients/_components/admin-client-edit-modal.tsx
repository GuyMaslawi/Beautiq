"use client";

import { useState, useEffect, useActionState } from "react";
import { X } from "lucide-react";
import { adminUpdateClientAction } from "@/server/admin/client-actions";
import type { AdminUpdateClientState } from "@/server/admin/client-actions";

interface AdminClientEditInitialData {
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  businessName: string;
}

interface Props {
  clientId: string;
  initialData: AdminClientEditInitialData;
}

const initialState: AdminUpdateClientState = {};

const fieldClass =
  "w-full rounded-xl border border-border bg-background-alt px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-light focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AdminClientEditModal({ clientId, initialData }: Props) {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState(0);

  const boundAction = adminUpdateClientAction.bind(null, clientId);
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
        className="bg-brand-gradient rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        עריכה
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface sm:max-w-md sm:rounded-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    עריכת לקוחה
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    עסק: {initialData.businessName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-muted transition-opacity hover:opacity-70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <form key={openKey} action={formAction} className="space-y-4 p-5">
                  {state.formError && (
                    <p
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--error-light)", color: "var(--error)" }}
                    >
                      {state.formError}
                    </p>
                  )}

                  {/* Full name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-muted">
                      שם לקוחה
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      defaultValue={initialData.fullName}
                      className={fieldClass}
                      style={
                        state.fieldErrors?.fullName
                          ? { borderColor: "var(--error)" }
                          : undefined
                      }
                    />
                    {state.fieldErrors?.fullName && (
                      <p className="text-xs" style={{ color: "var(--error)" }}>
                        {state.fieldErrors.fullName}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-muted">
                      טלפון
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      dir="ltr"
                      defaultValue={initialData.phone}
                      placeholder="0501234567"
                      className={`${fieldClass} text-left`}
                      style={
                        state.fieldErrors?.phone
                          ? { borderColor: "var(--error)" }
                          : undefined
                      }
                    />
                    {state.fieldErrors?.phone && (
                      <p className="text-xs" style={{ color: "var(--error)" }}>
                        {state.fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-muted">
                      אימייל
                    </label>
                    <input
                      type="email"
                      name="email"
                      dir="ltr"
                      defaultValue={initialData.email ?? ""}
                      placeholder="example@email.com"
                      className={`${fieldClass} text-left`}
                      style={
                        state.fieldErrors?.email
                          ? { borderColor: "var(--error)" }
                          : undefined
                      }
                    />
                    {state.fieldErrors?.email && (
                      <p className="text-xs" style={{ color: "var(--error)" }}>
                        {state.fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-muted">
                      הערות פנימיות
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={initialData.notes ?? ""}
                      placeholder="הערות על הלקוחה"
                      className={`${fieldClass} resize-none`}
                    />
                  </div>

                  {/* Opt-ins */}
                  <div className="space-y-2 rounded-xl bg-background-alt p-3">
                    <AdminCheckboxRow
                      name="whatsappOptIn"
                      label="מאשרת קבלת הודעות WhatsApp"
                      defaultChecked={initialData.whatsappOptIn}
                      color="var(--success)"
                    />
                    <AdminCheckboxRow
                      name="marketingOptIn"
                      label="מאשרת הודעות שיווקיות"
                      defaultChecked={initialData.marketingOptIn}
                      color="var(--info)"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-border bg-background-alt px-4 py-2 text-sm font-medium text-muted transition-opacity hover:opacity-80"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-brand-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {isPending ? "שומר…" : "שמירת שינויים"}
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

function AdminCheckboxRow({
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
      <span className="text-sm leading-5 text-foreground-soft">{label}</span>
    </label>
  );
}
