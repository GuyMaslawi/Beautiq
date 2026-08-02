"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  KeyRound,
  Gem,
  Ban,
  Copy,
  Check,
  PauseCircle,
  PlayCircle,
  ArrowLeftRight,
  Gift,
  Wallet,
  RotateCcw,
} from "lucide-react";
import {
  adminSetAccountPlanAction,
  adminSetCustomPriceAction,
  adminResetPasswordAction,
  adminToggleAdminRoleAction,
  adminSuspendAccountAction,
  adminTransferOwnershipAction,
  type AdminActionResult,
} from "@/server/admin/account-actions";
import { PLAN_PRICE } from "@/lib/plans";

type PlanValue = "standard" | "none";

interface Owner {
  id: string;
  name: string | null;
  email: string;
  plan: "standard" | "premium" | "platinum" | null;
  isAdmin: boolean;
  planExpiresAt: string | null;
  suspendedUntil: string | null;
  /** Admin-negotiated monthly price in agorot, or null for the list price. */
  customPriceMinor: number | null;
  /** What the live billing row charges each month, in agorot (null = no row). */
  billedPriceMinor: number | null;
  /** True when a real recurring charge is running (active / past due). */
  hasActiveBilling: boolean;
}

function dateHe(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** yyyy-mm-dd `days` from now — the shape adminSetAccountPlanAction expects. */
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Free-trial duration presets (days). */
const TRIAL_PRESETS = [14, 30, 60];

/** "₪149" from an agorot amount. */
function shekels(minor: number): string {
  return `₪${minor % 100 === 0 ? minor / 100 : (minor / 100).toFixed(2)}`;
}

export function GodControls({
  businessId,
  owner,
  isSelf,
}: {
  businessId: string;
  owner: Owner;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customPw, setCustomPw] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [trialDays, setTrialDays] = useState("30");
  const [customPrice, setCustomPrice] = useState(
    owner.customPriceMinor != null ? String(Math.round(owner.customPriceMinor / 100)) : "",
  );
  const [suspendDate, setSuspendDate] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  // "now" captured once at mount (lazy init keeps render pure).
  const [nowMs] = useState(() => Date.now());

  const currentPlan: PlanValue = owner.plan ? "standard" : "none";
  const isSuspended =
    !!owner.suspendedUntil && new Date(owner.suspendedUntil).getTime() > nowMs;

  function run(fn: () => Promise<AdminActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    setSecret(null);
    start(async () => {
      const res = await fn();
      if (res.success) {
        setMsg({ ok: true, text: res.message ?? "הפעולה בוצעה." });
        if (res.secret) setSecret(res.secret);
      } else {
        setMsg({ ok: false, text: res.error ?? "הפעולה נכשלה." });
      }
    });
  }

  const PLAN_OPTIONS: {
    value: PlanValue;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    { value: "standard", label: "מנוי Allura", icon: <Gem className="h-4 w-4" />, color: "var(--primary)" },
    { value: "none", label: "ללא גישה", icon: <Ban className="h-4 w-4" />, color: "var(--error)" },
  ];

  const trialDaysNum = Number(trialDays);
  const trialDaysValid = Number.isInteger(trialDaysNum) && trialDaysNum >= 1 && trialDaysNum <= 365;

  const customPriceNum = Number(customPrice);
  const customPriceValid =
    customPrice.trim() !== "" &&
    Number.isInteger(customPriceNum) &&
    customPriceNum >= 1 &&
    customPriceNum <= 10000;
  const listPriceMinor = owner.plan ? PLAN_PRICE * 100 : null;
  // The live billing row is the truth when there is one; otherwise the override,
  // and only then the list price of her plan.
  const billedNowMinor = owner.billedPriceMinor ?? owner.customPriceMinor ?? listPriceMinor;

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        borderColor: "color-mix(in srgb, var(--error) 25%, transparent)",
        background: "color-mix(in srgb, var(--error-light) 40%, var(--surface))",
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--error)" }} />
        <h2 className="text-sm font-bold text-foreground">כוחות אדמין — שליטה מלאה</h2>
      </div>
      <p className="mb-5 text-xs text-muted">
        פעולות רגישות על חשבון הבעלים ({owner.name ?? owner.email}). כל פעולה מתועדת ביומן.
      </p>

      {msg && (
        <div
          className="mb-4 rounded-xl px-3 py-2 text-sm"
          style={{
            background: msg.ok ? "var(--success-light)" : "var(--error-light)",
            color: msg.ok ? "var(--success)" : "var(--error)",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Plan / access override */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">גישה ותוכנית</p>
        <div className="flex flex-wrap gap-2">
          {PLAN_OPTIONS.map((opt) => {
            const active = currentPlan === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={pending || (active && !expiryDate)}
                onClick={() =>
                  run(
                    () =>
                      adminSetAccountPlanAction(
                        businessId,
                        owner.id,
                        opt.value,
                        opt.value === "none" ? null : expiryDate || null,
                      ),
                    opt.value === "none"
                      ? "לחסום את הגישה של בעלת העסק לאפליקציה? היא תוחזר למסך התשלום."
                      : undefined,
                  )
                }
                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-default"
                style={{
                  borderColor: active ? opt.color : "var(--border)",
                  background: active ? opt.color : "var(--surface)",
                  color: active ? "#fff" : "var(--foreground)",
                  opacity: pending && !active ? 0.6 : 1,
                }}
              >
                {opt.icon}
                {opt.label}
                {active && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">מנוי חינם עד תאריך (אופציונלי):</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="rounded-xl border border-border bg-surface px-2.5 py-1 text-sm text-foreground"
          />
          {expiryDate && (
            <button
              type="button"
              onClick={() => setExpiryDate("")}
              className="text-xs text-muted underline"
            >
              נקה
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          מעניק גישה מיידית לכל הכלים ללא חיוב ב-Grow, או חוסם גישה.
          {owner.planExpiresAt && (
            <span style={{ color: "var(--warning)" }}>
              {" "}
              המנוי הנוכחי פג ב־{dateHe(owner.planExpiresAt)}.
            </span>
          )}
        </p>
      </div>

      {/* Custom monthly price — a negotiated amount that replaces the list price */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">מחיר חודשי מותאם אישית</p>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">
            {billedNowMinor != null ? (
              <>
                מחויבת כרגע: <strong className="text-foreground">{shekels(billedNowMinor)}</strong> לחודש
              </>
            ) : (
              "אין עדיין חיוב חודשי (ללא תוכנית פעילה)"
            )}
          </span>
          <span
            className="rounded-lg px-2 py-0.5 font-semibold"
            style={{
              background:
                owner.customPriceMinor != null ? "var(--accent-light)" : "var(--background-alt)",
              color: owner.customPriceMinor != null ? "var(--accent)" : "var(--muted)",
            }}
          >
            {owner.customPriceMinor != null ? "מחיר מותאם" : "מחיר מחירון"}
          </span>
          {listPriceMinor != null && owner.customPriceMinor != null && (
            <span className="text-muted">(מחירון: {shekels(listPriceMinor)})</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder={listPriceMinor != null ? String(listPriceMinor / 100) : "149"}
              className="w-28 rounded-xl border border-border bg-surface px-2.5 py-1 text-sm text-foreground"
            />
            <span className="text-xs text-muted">₪ לחודש</span>
          </div>
          <button
            type="button"
            disabled={pending || !customPriceValid}
            onClick={() =>
              run(
                () => adminSetCustomPriceAction(businessId, owner.id, customPriceNum),
                `לקבוע לבעלת העסק חשבון חודשי קבוע של ₪${customPriceNum}? זה יהיה הסכום שייגבה ממנה כל חודש עד לשינוי.`,
              )
            }
            className="flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ borderColor: "var(--primary)", background: "var(--primary)", color: "#fff" }}
          >
            <Wallet className="h-3.5 w-3.5" />
            קבע מחיר חודשי
          </button>
          {owner.customPriceMinor != null && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => adminSetCustomPriceAction(businessId, owner.id, null),
                  "לבטל את המחיר המותאם ולחזור למחיר המחירון של התוכנית?",
                )
              }
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-alt disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              חזרה למחיר המחירון
            </button>
          )}
        </div>

        <p className="mt-1.5 text-xs text-muted">
          הסכום שנקבע כאן הוא החשבון החודשי הקבוע שלה — הוא חל על החיוב הבא ועל כל חידוש חודשי,
          נשמר גם אם משנים לה תוכנית, ותקף עד שתשנה אותו כאן. אם כבר יש לה הוראת קבע פעילה בסכום
          אחר, ההוראה הישנה תבוטל והיא תתבקש לאשר מחדש את הכרטיס בסכום החדש (הגישה לא נפגעת).
        </p>
        {customPrice.trim() !== "" && !customPriceValid && (
          <p className="mt-1 text-xs" style={{ color: "var(--error)" }}>
            יש להזין סכום שלם בין ₪1 ל־₪10,000. לגישה חינם יש להשתמש במנוי ניסיון שלמטה.
          </p>
        )}
      </div>

      {/* Free trial — duration only, comped with automatic expiry */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">מנוי ניסיון חינם</p>

        {/* How many days */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted">משך:</span>
          {TRIAL_PRESETS.map((days) => {
            const active = trialDays === String(days);
            return (
              <button
                key={days}
                type="button"
                disabled={pending}
                onClick={() => setTrialDays(String(days))}
                className="rounded-xl border px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-light)" : "var(--surface)",
                  color: active ? "var(--accent)" : "var(--foreground)",
                }}
              >
                {days} ימים
              </button>
            );
          })}
          <input
            type="number"
            min={1}
            max={365}
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="w-20 rounded-xl border border-border bg-surface px-2.5 py-1 text-sm text-foreground"
          />
          <span className="text-xs text-muted">ימים</span>
        </div>

        <button
          type="button"
          disabled={pending || !trialDaysValid}
          onClick={() =>
            run(
              () =>
                adminSetAccountPlanAction(
                  businessId,
                  owner.id,
                  "standard",
                  addDaysISO(trialDaysNum),
                ),
              `להעניק לבעלת העסק מנוי חינם ל־${trialDaysNum} ימים? הגישה תיפתח מיד ותיסגר אוטומטית בתום התקופה.`,
            )
          }
          className="mt-3 flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ borderColor: "var(--accent)", background: "var(--accent)", color: "#fff" }}
        >
          <Gift className="h-3.5 w-3.5" />
          הענק מנוי ניסיון
        </button>

        <p className="mt-1.5 text-xs text-muted">
          פותח את המנוי מיד וללא חיוב, ומסתיים אוטומטית בתום התקופה — ואז החשבון חוזר
          למסך התשלום מעצמו. לתאריך תפוגה מדויק אפשר להשתמש בשדה &quot;מנוי חינם עד תאריך&quot; שמעל.
        </p>
        {!trialDaysValid && (
          <p className="mt-1 text-xs" style={{ color: "var(--error)" }}>
            יש להזין מספר ימים בין 1 ל־365.
          </p>
        )}
        {owner.hasActiveBilling && (
          <p className="mt-1 text-xs" style={{ color: "var(--warning)" }}>
            שים לב: לחשבון הזה כבר יש הוראת קבע פעילה — מנוי ניסיון פותח גישה אך אינו עוצר את
            החיוב החודשי. כדי לעצור את החיוב יש לבטל את המנוי מצד בעלת העסק או ב-Grow.
          </p>
        )}
        {isSuspended && (
          <p className="mt-1 text-xs" style={{ color: "var(--warning)" }}>
            שים לב: החשבון מושהה כרגע — יש לבטל את ההשהיה למטה כדי שהמנוי ייכנס לתוקף (השהיה גוברת על תשלום).
          </p>
        )}
      </div>

      {/* Temporary suspension */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">השהיה זמנית</p>
        {isSuspended ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" style={{ color: "var(--warning)" }}>
              מושהה עד {dateHe(owner.suspendedUntil!)}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => adminSuspendAccountAction(businessId, owner.id, null))
              }
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-alt disabled:opacity-60"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              בטל השהיה
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={suspendDate}
              onChange={(e) => setSuspendDate(e.target.value)}
              className="rounded-xl border border-border bg-surface px-2.5 py-1 text-sm text-foreground"
            />
            <button
              type="button"
              disabled={pending || !suspendDate}
              onClick={() =>
                run(
                  () => adminSuspendAccountAction(businessId, owner.id, suspendDate),
                  "להשהות את גישת בעלת העסק לאפליקציה עד התאריך שנבחר?",
                )
              }
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--warning)" }}
            >
              <PauseCircle className="h-3.5 w-3.5" />
              השהה עד התאריך
            </button>
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted">
          בזמן השהיה החשבון חסום לחלוטין (גם תשלום לא פותח אותו) עד למועד שנבחר.
        </p>
      </div>

      {/* Transfer ownership */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">העברת בעלות</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            dir="ltr"
            value={transferEmail}
            onChange={(e) => setTransferEmail(e.target.value)}
            placeholder="אימייל הבעלים החדש"
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            disabled={pending || !transferEmail.trim()}
            onClick={() =>
              run(
                () => adminTransferOwnershipAction(businessId, transferEmail),
                `להעביר את הבעלות על העסק ל־${transferEmail.trim()}? הבעלים הנוכחי יאבד את הגישה לעסק זה.`,
              )
            }
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--error)" }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            העבר בעלות
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          מעביר את העסק למשתמש קיים אחר (לפי אימייל ההתחברות). הגישה תיקבע לפי התוכנית שלו.
        </p>
      </div>

      {/* Password reset */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold text-foreground-soft">איפוס סיסמה</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={customPw}
            onChange={(e) => setCustomPw(e.target.value)}
            placeholder="סיסמה חדשה (או השאר ריק ליצירה אוטומטית)"
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  adminResetPasswordAction(
                    businessId,
                    owner.id,
                    customPw.trim() || undefined,
                  ),
                "לאפס את הסיסמה של בעלת העסק?",
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-alt disabled:opacity-60"
          >
            <KeyRound className="h-3.5 w-3.5" />
            אפס סיסמה
          </button>
        </div>

        {secret && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <code className="flex-1 text-sm font-bold tracking-wide text-foreground" dir="ltr">
              {secret}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(secret).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "הועתק" : "העתק"}
            </button>
          </div>
        )}
        {secret && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--warning)" }}>
            שמור/העבר את הסיסמה עכשיו — היא מוצגת פעם אחת בלבד ולא נשמרת בשום מקום.
          </p>
        )}
      </div>

      {/* Admin role */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground-soft">הרשאת אדמין</p>
        {owner.isAdmin ? (
          <button
            type="button"
            disabled={pending || isSelf}
            onClick={() =>
              run(
                () => adminToggleAdminRoleAction(businessId, owner.id, false),
                "להסיר את הרשאת האדמין מהמשתמש?",
              )
            }
            className="rounded-xl border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--error)" }}
          >
            {isSelf ? "זהו החשבון שלך (אי אפשר להסיר)" : "הסר הרשאת אדמין"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => adminToggleAdminRoleAction(businessId, owner.id, true),
                "לקדם את המשתמש למנהל פלטפורמה? תהיה לו גישה מלאה לכל העסקים.",
              )
            }
            className="rounded-xl border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-alt disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            קדם למנהל פלטפורמה
          </button>
        )}
      </div>
    </div>
  );
}
