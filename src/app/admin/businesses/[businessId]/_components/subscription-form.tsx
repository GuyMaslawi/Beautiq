"use client";

import { useState, useTransition } from "react";
import { updateBusinessSubscription } from "@/server/admin/actions";
import type { SubscriptionStatus, SubscriptionPlan, DiscountType } from "@prisma/client";

const STATUS_OPTIONS = [
  { value: "trial", label: "בתקופת ניסיון" },
  { value: "active", label: "פעיל" },
  { value: "discounted", label: "בהנחה" },
  { value: "suspended", label: "מושהה" },
  { value: "cancelled", label: "בוטל" },
  { value: "pending_payment", label: "ממתין לתשלום" },
];

const PLAN_OPTIONS = [
  { value: "basic", label: "בסיס — ₪149/חודש" },
  { value: "pro", label: "פרו — ₪199/חודש" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: "none", label: "ללא הנחה" },
  { value: "fixed", label: "סכום קבוע (₪)" },
  { value: "percentage", label: "אחוז (%)" },
];

function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

interface SerializableSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthlyPrice: number;
  discountType: DiscountType;
  discountValue: number | null;
  discountNote: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  adminNotes: string | null;
}

interface Props {
  businessId: string;
  subscription: SerializableSubscription | null;
}

export function SubscriptionForm({ businessId, subscription }: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState(subscription?.plan ?? "basic");
  const [status, setStatus] = useState(subscription?.status ?? "trial");
  const [monthlyPrice, setMonthlyPrice] = useState(
    String(subscription?.monthlyPrice ?? 149),
  );
  const [discountType, setDiscountType] = useState(subscription?.discountType ?? "none");
  const [discountValue, setDiscountValue] = useState(
    subscription?.discountValue != null ? String(subscription.discountValue) : "",
  );
  const [discountNote, setDiscountNote] = useState(subscription?.discountNote ?? "");
  const [trialStartedAt, setTrialStartedAt] = useState(
    toDateInputValue(subscription?.trialStartedAt ? new Date(subscription.trialStartedAt) : null),
  );
  const [trialEndsAt, setTrialEndsAt] = useState(
    toDateInputValue(subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null),
  );
  const [adminNotes, setAdminNotes] = useState(subscription?.adminNotes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);
    startTransition(async () => {
      const result = await updateBusinessSubscription(businessId, {
        plan: plan as "basic" | "pro",
        status: status as
          | "trial"
          | "active"
          | "discounted"
          | "suspended"
          | "cancelled"
          | "pending_payment",
        monthlyPrice,
        discountType: discountType as "none" | "fixed" | "percentage",
        discountValue,
        discountNote,
        trialStartedAt,
        trialEndsAt,
        adminNotes,
      });
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error ?? "שגיאה בשמירה");
      }
    });
  }

  const inputClass =
    "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a1a2e]/15";
  const inputStyle = { borderColor: "rgba(0,0,0,0.12)", background: "#fff", color: "#1a1a2e" };
  const labelClass = "block text-xs font-semibold mb-1";
  const labelStyle = { color: "#555" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Plan */}
        <div>
          <label className={labelClass} style={labelStyle}>
            תוכנית
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as "basic" | "pro")}
            className={inputClass}
            style={inputStyle}
          >
            {PLAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={labelClass} style={labelStyle}>
            סטטוס
          </label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as
                  | "trial"
                  | "active"
                  | "discounted"
                  | "suspended"
                  | "cancelled"
                  | "pending_payment",
              )
            }
            className={inputClass}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Monthly price */}
        <div>
          <label className={labelClass} style={labelStyle}>
            מחיר חודשי (₪)
          </label>
          <input
            type="number"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
            min="0"
            step="1"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Discount type */}
        <div>
          <label className={labelClass} style={labelStyle}>
            סוג הנחה
          </label>
          <select
            value={discountType}
            onChange={(e) =>
              setDiscountType(e.target.value as "none" | "fixed" | "percentage")
            }
            className={inputClass}
            style={inputStyle}
          >
            {DISCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Discount value — shown only when discount is active */}
        {discountType !== "none" && (
          <div>
            <label className={labelClass} style={labelStyle}>
              {discountType === "fixed" ? "סכום הנחה (₪)" : "אחוז הנחה (%)"}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min="0"
              step="any"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        )}

        {/* Discount note */}
        {discountType !== "none" && (
          <div>
            <label className={labelClass} style={labelStyle}>
              הערת הנחה (פנימית)
            </label>
            <input
              type="text"
              value={discountNote}
              onChange={(e) => setDiscountNote(e.target.value)}
              placeholder="למשל: הנחת השקה"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        )}

        {/* Trial start */}
        <div>
          <label className={labelClass} style={labelStyle}>
            תחילת ניסיון
          </label>
          <input
            type="date"
            value={trialStartedAt}
            onChange={(e) => setTrialStartedAt(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Trial end */}
        <div>
          <label className={labelClass} style={labelStyle}>
            סיום ניסיון
          </label>
          <input
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Admin notes */}
      <div>
        <label className={labelClass} style={labelStyle}>
          הערות פנימיות
        </label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="הערות לשימוש פנימי בלבד — לא גלויות לבעל העסק"
          className={inputClass}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Feedback */}
      {success && (
        <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700">
          ✓ השינויים נשמרו בהצלחה
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "#1a1a2e" }}
      >
        {isPending ? "שומר..." : "שמור שינויים"}
      </button>
    </form>
  );
}
