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
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
        style={{ background: "#1a1a2e" }}
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
            <div
              className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh]"
              style={{ background: "#fff" }}
            >
              {/* Header */}
              <div
                className="flex shrink-0 items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
              >
                <div>
                  <h2 className="text-base font-bold" style={{ color: "#1a1a2e" }}>
                    עריכת לקוחה
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    עסק: {initialData.businessName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 transition-opacity hover:opacity-70"
                  style={{ color: "#888" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <form key={openKey} action={formAction} className="p-5 space-y-4">
                  {state.formError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {state.formError}
                    </p>
                  )}

                  {/* Full name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                      שם לקוחה
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      defaultValue={initialData.fullName}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.fullName ? "#dc2626" : "rgba(0,0,0,0.12)",
                        background: "#f9f9fb",
                        color: "#1a1a2e",
                      }}
                    />
                    {state.fieldErrors?.fullName && (
                      <p className="text-xs text-red-600">{state.fieldErrors.fullName}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                      טלפון
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      dir="ltr"
                      defaultValue={initialData.phone}
                      placeholder="0501234567"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.phone ? "#dc2626" : "rgba(0,0,0,0.12)",
                        background: "#f9f9fb",
                        color: "#1a1a2e",
                        textAlign: "left",
                      }}
                    />
                    {state.fieldErrors?.phone && (
                      <p className="text-xs text-red-600">{state.fieldErrors.phone}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                      אימייל
                    </label>
                    <input
                      type="email"
                      name="email"
                      dir="ltr"
                      defaultValue={initialData.email ?? ""}
                      placeholder="example@email.com"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: state.fieldErrors?.email ? "#dc2626" : "rgba(0,0,0,0.12)",
                        background: "#f9f9fb",
                        color: "#1a1a2e",
                        textAlign: "left",
                      }}
                    />
                    {state.fieldErrors?.email && (
                      <p className="text-xs text-red-600">{state.fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold" style={{ color: "#555" }}>
                      הערות פנימיות
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={initialData.notes ?? ""}
                      placeholder="הערות על הלקוחה"
                      className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{
                        borderColor: "rgba(0,0,0,0.12)",
                        background: "#f9f9fb",
                        color: "#1a1a2e",
                      }}
                    />
                  </div>

                  {/* Opt-ins */}
                  <div
                    className="space-y-2 rounded-xl p-3"
                    style={{ background: "#f3f4f6" }}
                  >
                    <AdminCheckboxRow
                      name="whatsappOptIn"
                      label="מאשרת קבלת הודעות WhatsApp"
                      defaultChecked={initialData.whatsappOptIn}
                      color="#16a34a"
                    />
                    <AdminCheckboxRow
                      name="marketingOptIn"
                      label="מאשרת הודעות שיווקיות"
                      defaultChecked={initialData.marketingOptIn}
                      color="#3b7ab5"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ color: "#555", background: "#f3f4f6", border: "1px solid rgba(0,0,0,0.1)" }}
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ background: "#1a1a2e" }}
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
      <span className="text-sm leading-5" style={{ color: "#444" }}>
        {label}
      </span>
    </label>
  );
}
