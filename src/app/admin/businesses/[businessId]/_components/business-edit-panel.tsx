"use client";

import { useActionState, useState } from "react";
import {
  adminUpdateBusinessAction,
  adminUpdateOwnerAction,
  type AdminUpdateBusinessState,
  type AdminUpdateOwnerState,
} from "@/server/admin/business-edit-actions";

export interface BusinessEditValues {
  name: string;
  slug: string;
  phone: string | null;
  description: string | null;
  timezone: string;
  city: string | null;
  area: string | null;
  addressNote: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  brandColor: string | null;
  introMessage: string | null;
  showServices: boolean;
  showPrices: boolean;
  showHours: boolean;
  showReviews: boolean;
  showGallery: boolean;
  showCancellationPolicy: boolean;
  showPhone: boolean;
  showAddress: boolean;
}

export interface OwnerEditValues {
  name: string | null;
  email: string;
}

interface Props {
  businessId: string;
  business: BusinessEditValues;
  owner: OwnerEditValues | null;
}

type Tab = "business" | "page" | "owner";

const inputClass =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a1a2e]/15";
const inputStyle = {
  borderColor: "rgba(0,0,0,0.12)",
  background: "#fff",
  color: "#1a1a2e",
} as const;
const labelClass = "block text-xs font-semibold mb-1";
const labelStyle = { color: "#555" } as const;

function errStyle(hasError?: boolean) {
  return hasError ? { ...inputStyle, borderColor: "#dc2626" } : inputStyle;
}

function TextField({
  label,
  name,
  defaultValue,
  error,
  placeholder,
  dir,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  type?: string;
}) {
  return (
    <div>
      <label className={labelClass} style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        dir={dir}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
        style={errStyle(!!error)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="h-4 w-4 cursor-pointer rounded"
        style={{ accentColor: "#1a1a2e" }}
      />
      <span className="text-sm" style={{ color: "#444" }}>
        {label}
      </span>
    </label>
  );
}

export function AdminBusinessEditPanel({ businessId, business, owner }: Props) {
  const [tab, setTab] = useState<Tab>("business");

  const bizAction = adminUpdateBusinessAction.bind(null, businessId);
  const [bizState, bizFormAction, bizPending] = useActionState<
    AdminUpdateBusinessState,
    FormData
  >(bizAction, {});

  const ownerAction = adminUpdateOwnerAction.bind(null, businessId);
  const [ownerState, ownerFormAction, ownerPending] = useActionState<
    AdminUpdateOwnerState,
    FormData
  >(ownerAction, {});

  const tabs: { key: Tab; label: string }[] = [
    { key: "business", label: "פרטי העסק" },
    { key: "page", label: "עמוד הזמנות" },
    { key: "owner", label: "בעלת העסק" },
  ];

  return (
    <div
      className="rounded-2xl border"
      style={{
        background: "#fff",
        borderColor: "rgba(0,0,0,0.07)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Tab bar */}
      <div
        className="flex gap-1 px-4 pt-4"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: active ? "#1a1a2e" : "#888",
                borderBottom: active ? "2px solid #1a1a2e" : "2px solid transparent",
                background: active ? "rgba(0,0,0,0.025)" : "transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {/* Business + public page share one form so a single save persists all
            Business fields. Sections are toggled with CSS so hidden inputs still
            submit. */}
        {tab !== "owner" && (
          <form action={bizFormAction} className="space-y-5">
            {bizState.formError && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                {bizState.formError}
              </p>
            )}

            {/* --- Business details --- */}
            <div className={tab === "business" ? "space-y-4" : "hidden"}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="שם העסק"
                  name="name"
                  defaultValue={business.name}
                  error={bizState.fieldErrors?.name}
                  placeholder="לדוגמה: הסטודיו של יעל"
                />
                <TextField
                  label="כתובת קישור (Slug)"
                  name="slug"
                  defaultValue={business.slug}
                  error={bizState.fieldErrors?.slug}
                  dir="ltr"
                  placeholder="studio-yael"
                />
                <TextField
                  label="טלפון העסק"
                  name="phone"
                  defaultValue={business.phone ?? ""}
                  error={bizState.fieldErrors?.phone}
                  dir="ltr"
                  placeholder="050-0000000"
                />
                <TextField
                  label="עיר"
                  name="city"
                  defaultValue={business.city ?? ""}
                  placeholder="תל אביב"
                />
                <TextField
                  label="אזור / שכונה"
                  name="area"
                  defaultValue={business.area ?? ""}
                />
                <TextField
                  label="אזור זמן"
                  name="timezone"
                  defaultValue={business.timezone}
                  dir="ltr"
                  placeholder="Asia/Jerusalem"
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="addressNote">
                  הערת כתובת (קומה / כניסה)
                </label>
                <input
                  id="addressNote"
                  name="addressNote"
                  defaultValue={business.addressNote ?? ""}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="description">
                  תיאור העסק
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={business.description ?? ""}
                  className={inputClass}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>

            {/* --- Public booking page --- */}
            <div className={tab === "page" ? "space-y-4" : "hidden"}>
              <div>
                <label className={labelClass} style={labelStyle} htmlFor="introMessage">
                  הודעת פתיחה בעמוד ההזמנות
                </label>
                <textarea
                  id="introMessage"
                  name="introMessage"
                  rows={2}
                  defaultValue={business.introMessage ?? ""}
                  className={inputClass}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="קישור לוגו"
                  name="logoUrl"
                  defaultValue={business.logoUrl ?? ""}
                  dir="ltr"
                  placeholder="https://…"
                />
                <TextField
                  label="קישור תמונת רקע"
                  name="coverImageUrl"
                  defaultValue={business.coverImageUrl ?? ""}
                  dir="ltr"
                  placeholder="https://…"
                />
                <TextField
                  label="אינסטגרם"
                  name="instagramUrl"
                  defaultValue={business.instagramUrl ?? ""}
                  dir="ltr"
                  placeholder="https://instagram.com/…"
                />
                <TextField
                  label="פייסבוק"
                  name="facebookUrl"
                  defaultValue={business.facebookUrl ?? ""}
                  dir="ltr"
                  placeholder="https://facebook.com/…"
                />
                <TextField
                  label="צבע מותג"
                  name="brandColor"
                  defaultValue={business.brandColor ?? ""}
                  error={bizState.fieldErrors?.brandColor}
                  dir="ltr"
                  placeholder="#C9A24B"
                />
              </div>
              <div
                className="grid grid-cols-1 gap-2.5 rounded-xl p-4 sm:grid-cols-2"
                style={{ background: "#f9f9fb" }}
              >
                <p
                  className="col-span-full text-xs font-semibold"
                  style={{ color: "#888" }}
                >
                  מה מוצג בעמוד ההזמנות הציבורי
                </p>
                <Toggle name="showServices" label="שירותים" defaultChecked={business.showServices} />
                <Toggle name="showPrices" label="מחירים" defaultChecked={business.showPrices} />
                <Toggle name="showHours" label="שעות פעילות" defaultChecked={business.showHours} />
                <Toggle name="showReviews" label="ביקורות" defaultChecked={business.showReviews} />
                <Toggle name="showGallery" label="גלריה" defaultChecked={business.showGallery} />
                <Toggle
                  name="showCancellationPolicy"
                  label="מדיניות ביטול"
                  defaultChecked={business.showCancellationPolicy}
                />
                <Toggle name="showPhone" label="טלפון" defaultChecked={business.showPhone} />
                <Toggle name="showAddress" label="כתובת" defaultChecked={business.showAddress} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={bizPending}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "#1a1a2e" }}
              >
                {bizPending ? "שומר…" : "שמירת שינויים"}
              </button>
              {bizState.success && (
                <span className="text-sm font-medium text-green-700">
                  ✓ השינויים נשמרו
                </span>
              )}
            </div>
          </form>
        )}

        {/* --- Owner account --- */}
        {tab === "owner" && (
          <>
            {!owner ? (
              <p className="text-sm" style={{ color: "#888" }}>
                לא נמצא בעלים לעסק זה.
              </p>
            ) : (
              <form action={ownerFormAction} className="space-y-5">
                <p className="text-xs" style={{ color: "#888" }}>
                  עריכת חשבון המשתמש של בעלת העסק. האימייל משמש להתחברות למערכת.
                </p>
                {ownerState.formError && (
                  <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                    {ownerState.formError}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="שם הבעלים"
                    name="name"
                    defaultValue={owner.name ?? ""}
                    error={ownerState.fieldErrors?.name}
                  />
                  <TextField
                    label="אימייל (התחברות)"
                    name="email"
                    defaultValue={owner.email}
                    error={ownerState.fieldErrors?.email}
                    dir="ltr"
                    type="email"
                    placeholder="owner@email.com"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={ownerPending}
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: "#1a1a2e" }}
                  >
                    {ownerPending ? "שומר…" : "שמירת שינויים"}
                  </button>
                  {ownerState.success && (
                    <span className="text-sm font-medium text-green-700">
                      ✓ פרטי הבעלים נשמרו
                    </span>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
