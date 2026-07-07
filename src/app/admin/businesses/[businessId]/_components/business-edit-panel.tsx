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
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-light hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20";
const inputStyle = {} as const;
const labelClass = "block text-xs font-semibold mb-1 text-muted";
const labelStyle = {} as const;

function errStyle(hasError?: boolean) {
  return hasError ? { borderColor: "var(--error)" } : inputStyle;
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
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
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
        style={{ accentColor: "var(--primary)" }}
      />
      <span className="text-sm text-foreground-soft">{label}</span>
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
      className="rounded-2xl border border-border bg-surface"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-4 pt-4">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: active ? "var(--primary)" : "var(--muted)",
                borderBottom: active
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                background: active ? "var(--primary-light)" : "transparent",
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
              <p
                className="rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ background: "var(--error-light)", color: "var(--error)" }}
              >
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
              <div className="grid grid-cols-1 gap-2.5 rounded-xl bg-background-alt p-4 sm:grid-cols-2">
                <p className="col-span-full text-xs font-semibold text-muted">
                  מה מוצג בעמוד ההזמנות הציבורי
                </p>
                <Toggle name="showServices" label="שירותים" defaultChecked={business.showServices} />
                <Toggle name="showPrices" label="מחירים" defaultChecked={business.showPrices} />
                <Toggle name="showHours" label="שעות פעילות" defaultChecked={business.showHours} />
                <Toggle name="showReviews" label="ביקורות" defaultChecked={business.showReviews} />
                <Toggle name="showGallery" label="גלריה" defaultChecked={business.showGallery} />
                <Toggle name="showPhone" label="טלפון" defaultChecked={business.showPhone} />
                <Toggle name="showAddress" label="כתובת" defaultChecked={business.showAddress} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={bizPending}
                className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {bizPending ? "שומר…" : "שמירת שינויים"}
              </button>
              {bizState.success && (
                <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
                  השינויים נשמרו
                </span>
              )}
            </div>
          </form>
        )}

        {/* --- Owner account --- */}
        {tab === "owner" && (
          <>
            {!owner ? (
              <p className="text-sm text-muted">לא נמצא בעלים לעסק זה.</p>
            ) : (
              <form action={ownerFormAction} className="space-y-5">
                <p className="text-xs text-muted">
                  עריכת חשבון המשתמש של בעלת העסק. האימייל משמש להתחברות למערכת.
                </p>
                {ownerState.formError && (
                  <p
                    className="rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ background: "var(--error-light)", color: "var(--error)" }}
                  >
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
                    className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {ownerPending ? "שומר…" : "שמירת שינויים"}
                  </button>
                  {ownerState.success && (
                    <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
                      פרטי הבעלים נשמרו
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
