"use client";

import { Fragment, useActionState, useState, useEffect } from "react";
import { Clock, Check, ChevronRight, Calendar, Zap, ShieldCheck, Lock } from "lucide-react";
import {
  submitPublicBookingAction,
  type PublicBookingFormState,
} from "@/server/public-booking/actions";
import type {
  PublicService,
  PublicCancellationPolicy,
} from "@/server/public-booking/queries";
import type { UpcomingSlotGroup } from "@/app/api/public/[slug]/upcoming-slots/route";
import { PAYMENTS } from "@/lib/constants/he";
import { computePaymentAmount, formatMinorILS } from "@/lib/payments/money";
import { useBookingSelection } from "./_components/booking-selection";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Step = "service" | "quickpick" | "calendar" | "details";

const DEFAULT_BRAND = "#b86b8c";

/** Public-safe payment policy passed to the form (never includes credentials). */
export interface PaymentPolicyClient {
  requirement: "none" | "deposit" | "full_payment";
  depositType: "fixed_amount" | "percentage";
  depositAmountMinor: number | null;
  depositPercentage: number | null;
  allowPayAtBusiness: boolean;
  instructions: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateHebrew(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(y, m - 1, d));
  } catch {
    return dateStr;
  }
}

function toWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  step,
  brandColor,
}: {
  step: Step;
  brandColor: string;
}) {
  const steps: { id: Step; label: string }[] = [
    { id: "service", label: "שירות" },
    { id: "quickpick", label: "תאריך" },
    { id: "details", label: "פרטים" },
  ];
  // quickpick and calendar both map to step index 1
  const currentIdx = step === "calendar" ? 1 : steps.findIndex((s) => s.id === step);
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;

  return (
    <div className="flex items-center justify-center mb-8" dir="ltr">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5 w-16">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={
                  active
                    ? { background: brandGrd, color: "white", boxShadow: `0 2px 8px ${brandColor}66` }
                    : done
                    ? { background: brandColor, color: "white" }
                    : { background: "#f3f4f6", color: "#9ca3af" }
                }
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className="text-xs text-center"
                style={
                  active
                    ? { fontWeight: 700, color: "var(--foreground)" }
                    : { color: "var(--muted)" }
                }
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-0.5 w-10 mb-5 flex-shrink-0 transition-colors rounded-full"
                style={{ background: i < currentIdx ? brandColor : "#e5e7eb" }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------

function ServiceCard({
  service,
  selected,
  onSelect,
  showPrices,
  brandColor,
}: {
  service: PublicService;
  selected: boolean;
  onSelect: () => void;
  showPrices: boolean;
  brandColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border-2 p-4 text-right transition-all hover:shadow-md"
      style={{
        borderColor: selected ? brandColor : "var(--border)",
        background: selected ? `${brandColor}08` : "white",
        boxShadow: selected ? `0 0 0 4px ${brandColor}18` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--foreground)] text-base">{service.name}</p>
          {service.description && (
            <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">
              {service.description}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-0.5 text-xs text-[var(--muted)] border border-gray-100">
              <Clock className="h-3 w-3" />
              {service.durationMinutes} דקות
            </span>
            {showPrices && (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors"
                style={{
                  background: selected ? brandColor : `${brandColor}18`,
                  color: selected ? "white" : brandColor,
                }}
              >
                ₪{Number(service.price).toLocaleString("he-IL")}
              </span>
            )}
          </div>
        </div>
        <div
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
          style={{
            borderColor: selected ? brandColor : "#d1d5db",
            background: selected ? brandColor : "transparent",
          }}
        >
          {selected && <Check className="h-3.5 w-3.5 text-white" />}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Upcoming slot quick-pick
// ---------------------------------------------------------------------------

function QuickPickSlots({
  slug,
  serviceId,
  onSelect,
  onShowCalendar,
  brandColor,
}: {
  slug: string;
  serviceId: string;
  onSelect: (date: string, time: string) => void;
  onShowCalendar: () => void;
  brandColor: string;
}) {
  const [groups, setGroups] = useState<UpcomingSlotGroup[] | null>(null);
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    fetch(`/api/public/${slug}/upcoming-slots?serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data: { groups?: UpcomingSlotGroup[] }) => {
        if (!cancelled) setGroups(data.groups ?? []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => { cancelled = true; };
  }, [serviceId, slug]);

  if (groups === null) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-[var(--muted)]">
        <div
          className="h-5 w-5 rounded-full border-2 animate-spin"
          style={{ borderColor: brandColor, borderTopColor: "transparent" }}
        />
        מאתרת שעות פנויות…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-6 space-y-4">
        <p className="text-sm text-[var(--muted)]">אין שעות פנויות בימים הקרובים</p>
        <button
          type="button"
          onClick={onShowCalendar}
          className="flex items-center justify-center gap-2 mx-auto rounded-xl px-5 py-2.5 text-sm font-semibold border-2 transition-all"
          style={{ borderColor: brandColor, color: brandColor }}
        >
          <Calendar className="h-4 w-4" />
          בחרי תאריך מהלוח
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick slot groups */}
      {groups.map((group) => (
        <div key={group.date}>
          <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {group.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(group.date, slot)}
                className="rounded-xl px-4 py-2 text-sm font-bold transition-all hover:opacity-90 active:scale-[.97]"
                style={{ background: brandGrd, color: "white" }}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Fallback to full calendar */}
      <button
        type="button"
        onClick={onShowCalendar}
        className="flex items-center gap-1.5 text-xs font-semibold mt-2 transition-opacity hover:opacity-70"
        style={{ color: "var(--muted)" }}
      >
        <Calendar className="h-3.5 w-3.5" />
        הצגי כל התאריכים
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time slot pill
// ---------------------------------------------------------------------------

function SlotPill({
  time,
  selected,
  onSelect,
  brandColor,
}: {
  time: string;
  selected: boolean;
  onSelect: () => void;
  brandColor: string;
}) {
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
      style={{
        background: selected ? brandGrd : "white",
        color: selected ? "white" : "var(--foreground)",
        border: `2px solid ${selected ? brandColor : "var(--border)"}`,
        boxShadow: selected ? `0 2px 10px ${brandColor}55` : undefined,
      }}
    >
      {time}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared input primitive
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 transition-shadow";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-500">{message}</p>;
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-0.5 text-sm transition-colors"
      style={{ color: "var(--muted)" }}
    >
      <ChevronRight className="h-4 w-4" />
      חזרה
    </button>
  );
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
  brandColor,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  brandColor: string;
}) {
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl py-4 text-sm font-bold transition-all hover:opacity-90 active:scale-[.98] disabled:cursor-not-allowed disabled:hover:opacity-100 shadow-sm"
      style={
        disabled
          ? { background: "#f1edf0", color: "#9a8f96" }
          : { background: brandGrd, color: "white" }
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Success view
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Secure payment card — trust microcopy + amount (premium, RTL)
// ---------------------------------------------------------------------------

function SecurePaymentCard({
  title,
  amountLabel,
  amountMinor,
  brandColor,
  instructions,
  children,
}: {
  title: string;
  amountLabel?: string;
  amountMinor?: number;
  brandColor: string;
  instructions?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-5 space-y-4"
      style={{ borderColor: `${brandColor}33`, boxShadow: `0 0 0 4px ${brandColor}0d` }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${brandColor}14`, color: brandColor }}
        >
          <Lock className="h-4 w-4" />
        </div>
        <p className="font-bold text-sm text-[var(--foreground)]">{title}</p>
      </div>

      {amountLabel && typeof amountMinor === "number" && (
        <div
          className="flex items-baseline justify-between rounded-xl px-4 py-3"
          style={{ background: `${brandColor}0d` }}
        >
          <span className="text-sm text-[var(--muted)]">{amountLabel}</span>
          <span className="text-lg font-bold" style={{ color: brandColor }}>
            {formatMinorILS(amountMinor)}
          </span>
        </div>
      )}

      {instructions && (
        <p className="text-xs leading-relaxed text-[var(--muted)]">{instructions}</p>
      )}

      {children}

      <div className="space-y-1 pt-1">
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--muted)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {PAYMENTS.publicStep.trustHostedPage}
        </p>
        <p className="text-center text-[11px] text-[var(--muted)]">
          {PAYMENTS.publicStep.trustNoCardStored}
        </p>
      </div>
    </div>
  );
}

function SuccessView({
  serviceName,
  date,
  time,
  businessName,
  businessPhone,
  serviceDuration,
  onReset,
  brandColor,
  payment,
}: {
  serviceName?: string;
  date: string;
  time: string;
  businessName: string;
  businessPhone?: string | null;
  serviceDuration?: number;
  onReset: () => void;
  brandColor: string;
  payment?: {
    paymentUrl?: string;
    paymentKind?: "deposit" | "full";
    paymentAmountMinor?: number;
    payAtBusinessAllowed?: boolean;
    paymentLinkFailed?: boolean;
  };
}) {
  const formattedDate = formatDateHebrew(date);
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;

  const msgText = `היי! קבעתי תור ל${serviceName ?? "טיפול"} אצל ${businessName}. ${formattedDate} בשעה ${time} 🎉`;
  const waTarget = businessPhone
    ? `https://wa.me/${toWhatsAppPhone(businessPhone)}?text=${encodeURIComponent(msgText)}`
    : `https://wa.me/?text=${encodeURIComponent(msgText)}`;

  const [y, m, d] = date.split("-");
  const [hh, mm] = time.split(":");
  const calStart = `${y}${m}${d}T${hh}${mm}00`;
  const endMinTotal = parseInt(hh) * 60 + parseInt(mm) + (serviceDuration ?? 60);
  const endH = Math.floor(endMinTotal / 60).toString().padStart(2, "0");
  const endM = (endMinTotal % 60).toString().padStart(2, "0");
  const calEnd = `${y}${m}${d}T${endH}${endM}00`;
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${serviceName ?? "תור"} — ${businessName}`)}&dates=${calStart}/${calEnd}`;

  return (
    <div className="text-center space-y-6 py-4">
      <div
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-5xl"
        style={{ background: `linear-gradient(135deg, ${brandColor}22, ${brandColor}44)` }}
      >
        🎉
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          הבקשה נשלחה!
        </h2>
        <p className="text-sm text-[var(--muted)]">
          העסק יחזור אליך לאישור התור
        </p>
      </div>

      {/* Online payment (deposit / full) — booking is already saved as pending */}
      {payment?.paymentKind && (
        <div className="mx-auto max-w-sm text-right">
          {payment.paymentUrl ? (
            <SecurePaymentCard
              title={
                payment.paymentKind === "deposit"
                  ? PAYMENTS.publicStep.depositTitle
                  : PAYMENTS.publicStep.fullTitle
              }
              amountLabel={
                payment.paymentKind === "deposit"
                  ? PAYMENTS.publicStep.depositAmountLabel
                  : PAYMENTS.publicStep.fullAmountLabel
              }
              amountMinor={payment.paymentAmountMinor}
              brandColor={brandColor}
            >
              <a
                href={payment.paymentUrl}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98]"
                style={{ background: `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)` }}
              >
                {PAYMENTS.publicStep.paySecure}
              </a>
              {payment.payAtBusinessAllowed && (
                <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
                  {PAYMENTS.returnStatus.failureBody}
                </p>
              )}
            </SecurePaymentCard>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {payment.payAtBusinessAllowed
                ? PAYMENTS.publicStep.optionalTitle
                : PAYMENTS.errors.providerError}
            </div>
          )}
        </div>
      )}

      <div
        className="mx-auto max-w-xs rounded-2xl px-6 py-5 space-y-3"
        style={{ background: `linear-gradient(135deg, ${brandColor}0d, ${brandColor}1e)` }}
      >
        {serviceName && (
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-[var(--foreground)]">
            <span>✨</span>
            <span>{serviceName}</span>
          </div>
        )}
        {formattedDate && (
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--foreground)]">
            <span>📅</span>
            <span>{formattedDate}</span>
          </div>
        )}
        {time && (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <span>🕐</span>
            <span>בשעה {time}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={calUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:opacity-90"
          style={{ background: brandGrd, color: "white" }}
        >
          📅 הוספה ליומן
        </a>
        <a
          href={waTarget}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 py-3.5 text-sm font-bold transition-all"
          style={{ borderColor: brandColor, color: brandColor }}
        >
          💬 שלחי בוואטסאפ
        </a>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="text-sm underline underline-offset-2 hover:opacity-75 transition-opacity"
        style={{ color: "var(--muted)" }}
      >
        שליחת בקשה נוספת
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function BookingRequestForm({
  slug,
  services,
  cancellationPolicy,
  showPrices = true,
  initialServiceId = "",
  businessName,
  businessPhone,
  brandColor = DEFAULT_BRAND,
  paymentPolicy = null,
}: {
  slug: string;
  services: PublicService[];
  cancellationPolicy: PublicCancellationPolicy | null;
  showPrices?: boolean;
  initialServiceId?: string;
  businessName: string;
  businessPhone?: string | null;
  brandColor?: string;
  paymentPolicy?: PaymentPolicyClient | null;
}) {
  const boundAction = submitPublicBookingAction.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    PublicBookingFormState,
    FormData
  >(boundAction, {});

  const [step, setStep] = useState<Step>(
    initialServiceId ? "quickpick" : "service",
  );
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  const slotsLoading =
    step === "calendar" && !!selectedDate && !!selectedServiceId && slots === null;

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Publish the live selection to the right-column summary (desktop). Safe no-op
  // when rendered without a provider (e.g. unit tests).
  const { setSelection } = useBookingSelection();
  useEffect(() => {
    const svc = services.find((s) => s.id === selectedServiceId);
    if (!svc || step === "service") {
      setSelection(null);
      return;
    }
    const preview = paymentPolicy
      ? computePaymentAmount(
          paymentPolicy,
          Math.round(Number(svc.price) * 100),
        )
      : null;
    setSelection({
      serviceName: svc.name,
      date: selectedDate,
      time: selectedTime,
      active: true,
      amountMinor: preview?.amountMinor,
      paymentKind: preview?.kind,
    });
  }, [
    step,
    selectedServiceId,
    selectedDate,
    selectedTime,
    services,
    paymentPolicy,
    setSelection,
  ]);

  // Fetch slots when on full calendar step and date changes
  useEffect(() => {
    if (step !== "calendar" || !selectedDate || !selectedServiceId) return;
    let cancelled = false;
    fetch(`/api/public/${slug}/slots?date=${selectedDate}&serviceId=${selectedServiceId}`)
      .then((r) => r.json())
      .then((data: { slots?: string[] }) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => { cancelled = true; };
  }, [selectedDate, selectedServiceId, step, slug]);

  function handleServiceSelect(id: string) {
    if (id !== selectedServiceId) {
      setSelectedDate("");
      setSelectedTime("");
      setSlots(null);
    }
    setSelectedServiceId(id);
  }

  function handleQuickPickSelect(date: string, time: string) {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("details");
  }

  if (state.success) {
    return (
      <SuccessView
        serviceName={selectedService?.name}
        date={selectedDate}
        time={selectedTime}
        businessName={businessName}
        businessPhone={businessPhone}
        serviceDuration={selectedService?.durationMinutes}
        onReset={() => window.location.reload()}
        brandColor={brandColor}
        payment={{
          paymentUrl: state.paymentUrl,
          paymentKind: state.paymentKind,
          paymentAmountMinor: state.paymentAmountMinor,
          payAtBusinessAllowed: state.payAtBusinessAllowed,
          paymentLinkFailed: state.paymentLinkFailed,
        }}
      />
    );
  }

  const needsPolicy = !!cancellationPolicy?.policyText;

  // Preview the required payment for the selected service (computed client-side
  // for display only; the server recomputes authoritatively on submit).
  const paymentPreview =
    paymentPolicy && selectedService
      ? computePaymentAmount(
          paymentPolicy,
          Math.round(Number(selectedService.price) * 100),
        )
      : null;
  const requiresPayment =
    !!paymentPreview &&
    paymentPreview.amountMinor > 0 &&
    (paymentPreview.kind === "deposit" || paymentPreview.kind === "full");

  return (
    <form action={formAction} noValidate>
      {/* Hidden inputs */}
      <input type="hidden" name="serviceId" value={selectedServiceId} />
      <input type="hidden" name="date" value={selectedDate} />
      <input type="hidden" name="requestedTime" value={selectedTime} />

      <StepIndicator step={step} brandColor={brandColor} />

      {/* ── STEP 1: Service ─────────────────────────────────────────────── */}
      {step === "service" && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[var(--foreground)] mb-1">
            באיזה שירות את מעוניינת?
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={selectedServiceId === service.id}
                onSelect={() => handleServiceSelect(service.id)}
                showPrices={showPrices}
                brandColor={brandColor}
              />
            ))}
          </div>

          {selectedService?.requiresDeposit && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              נדרשת מקדמה לשירות זה — התשלום יתואם מול העסק
            </p>
          )}

          <PrimaryBtn
            disabled={!selectedServiceId}
            onClick={() => setStep("quickpick")}
            brandColor={brandColor}
          >
            {selectedServiceId
              ? "המשך לבחירת תאריך ושעה"
              : "בחרי שירות כדי להמשיך"}
          </PrimaryBtn>
        </div>
      )}

      {/* ── STEP 2A: Smart quick-pick ─────────────────────────────────── */}
      {step === "quickpick" && (
        <div className="space-y-5">
          {/* Selected service summary */}
          {selectedService && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between text-sm"
              style={{ background: `${brandColor}0d` }}
            >
              <span className="font-bold text-[var(--foreground)]">
                {selectedService.name}
              </span>
              <button
                type="button"
                onClick={() => setStep("service")}
                className="text-xs font-semibold hover:underline"
                style={{ color: brandColor }}
              >
                שינוי
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 shrink-0" style={{ color: brandColor }} />
              <span className="font-semibold text-sm text-[var(--foreground)]">
                התורים הקרובים
              </span>
            </div>
            <QuickPickSlots
              slug={slug}
              serviceId={selectedServiceId}
              onSelect={handleQuickPickSelect}
              onShowCalendar={() => {
                setSelectedDate("");
                setSelectedTime("");
                setSlots(null);
                setStep("calendar");
              }}
              brandColor={brandColor}
            />
          </div>

          <div className="flex justify-end">
            <BackBtn onClick={() => setStep("service")} />
          </div>
        </div>
      )}

      {/* ── STEP 2B: Full calendar ────────────────────────────────────── */}
      {step === "calendar" && (
        <div className="space-y-5">
          {/* Selected service summary */}
          {selectedService && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between text-sm"
              style={{ background: `${brandColor}0d` }}
            >
              <span className="font-bold text-[var(--foreground)]">
                {selectedService.name}
              </span>
              <button
                type="button"
                onClick={() => setStep("service")}
                className="text-xs font-semibold hover:underline"
                style={{ color: brandColor }}
              >
                שינוי
              </button>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
              בחרי תאריך
            </label>
            <input
              type="date"
              min={todayISO()}
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime("");
                setSlots(null);
              }}
              className={inputCls}
            />
          </div>

          {selectedDate && (
            <div>
              <label className="mb-3 block text-sm font-semibold text-[var(--foreground)]">
                בחרי שעה
              </label>
              {slotsLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-[var(--muted)]">
                  <div
                    className="h-5 w-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: brandColor, borderTopColor: "transparent" }}
                  />
                  טוענת שעות פנויות…
                </div>
              ) : slots !== null && slots.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 p-6 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    אין שעות פנויות בתאריך זה
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    נסי לבחור תאריך אחר
                  </p>
                </div>
              ) : slots !== null ? (
                <div className="flex flex-wrap gap-2" dir="ltr">
                  {slots.map((time) => (
                    <SlotPill
                      key={time}
                      time={time}
                      selected={selectedTime === time}
                      onSelect={() => setSelectedTime(time)}
                      brandColor={brandColor}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {(state.errors?.date || state.errors?.requestedTime) && (
            <FieldError message={state.errors.date ?? state.errors.requestedTime} />
          )}

          <PrimaryBtn
            disabled={!selectedDate || !selectedTime}
            onClick={() => setStep("details")}
            brandColor={brandColor}
          >
            המשך למילוי פרטים →
          </PrimaryBtn>

          <div className="flex justify-end">
            <BackBtn onClick={() => setStep("quickpick")} />
          </div>
        </div>
      )}

      {/* ── STEP 3: Personal details + submit ───────────────────────────── */}
      {step === "details" && (
        <div className="space-y-4">
          {state.formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.formError}
              {state.formError.includes("תפוס") && (
                <button
                  type="button"
                  onClick={() => setStep("quickpick")}
                  className="block mt-1.5 text-xs font-semibold underline"
                >
                  חזרה לבחירת שעה
                </button>
              )}
            </div>
          )}

          {/* Booking summary bar */}
          {selectedService && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between text-sm"
              style={{ background: `${brandColor}0d` }}
            >
              <div>
                <span className="font-bold text-[var(--foreground)]">
                  {selectedService.name}
                </span>
                {selectedDate && selectedTime && (
                  <span className="text-[var(--muted)] mr-2 text-xs">
                    · {formatDateHebrew(selectedDate)}, {selectedTime}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep("quickpick")}
                className="text-xs font-semibold hover:underline"
                style={{ color: brandColor }}
              >
                שינוי
              </button>
            </div>
          )}

          <div>
            <label htmlFor="clientName" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
              שם מלא
            </label>
            <input
              id="clientName"
              name="clientName"
              type="text"
              autoComplete="name"
              placeholder="לדוגמה: נועה כהן"
              className={inputCls}
              aria-invalid={!!state.errors?.clientName}
            />
            <FieldError message={state.errors?.clientName} />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
              טלפון
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="050-0000000"
              className={inputCls}
              dir="ltr"
              aria-invalid={!!state.errors?.phone}
            />
            <FieldError message={state.errors?.phone} />
          </div>

          <div>
            <label htmlFor="note" className="mb-1.5 block text-sm font-semibold text-[var(--foreground)]">
              הערה קצרה{" "}
              <span className="text-xs font-normal text-[var(--muted)]">(אופציונלי)</span>
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              placeholder="אם יש משהו שחשוב לדעת…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {needsPolicy && (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4 space-y-3">
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                מדיניות ביטולים
              </h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {cancellationPolicy!.policyText}
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={policyAcknowledged}
                  onChange={(e) => setPolicyAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--muted)]">
                  קראתי את מדיניות הביטולים ואני מסכימה לתנאיה
                </span>
              </label>
            </div>
          )}

          {/* Secure-payment preview — shown only when a payment is required */}
          {requiresPayment && paymentPreview && (
            <SecurePaymentCard
              title={
                paymentPreview.kind === "deposit"
                  ? PAYMENTS.publicStep.depositTitle
                  : PAYMENTS.publicStep.fullTitle
              }
              amountLabel={
                paymentPreview.kind === "deposit"
                  ? PAYMENTS.publicStep.depositAmountLabel
                  : PAYMENTS.publicStep.fullAmountLabel
              }
              amountMinor={paymentPreview.amountMinor}
              brandColor={brandColor}
              instructions={paymentPolicy?.instructions}
            />
          )}

          <p className="text-center text-xs text-[var(--muted)] leading-5">
            {requiresPayment
              ? PAYMENTS.publicStep.submitNote
              : "הבקשה תישלח לעסק לאישור. התור יאושר רק אחרי שהעסק יאשר אותו."}
          </p>

          <button
            type="submit"
            disabled={pending || (needsPolicy && !policyAcknowledged)}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ background: `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)` }}
          >
            {pending
              ? "שולח…"
              : requiresPayment
                ? PAYMENTS.publicStep.paySecure
                : "שליחת בקשה לתור ✓"}
          </button>

          <div className="flex justify-end">
            <BackBtn onClick={() => setStep("quickpick")} />
          </div>
        </div>
      )}
    </form>
  );
}
