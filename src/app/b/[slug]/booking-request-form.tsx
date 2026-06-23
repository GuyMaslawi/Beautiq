"use client";

import { Fragment, useActionState, useState, useEffect } from "react";
import { Clock, Check, ChevronRight, Calendar, Zap } from "lucide-react";
import {
  submitPublicBookingAction,
  type PublicBookingFormState,
} from "@/server/public-booking/actions";
import type { PublicService } from "@/server/public-booking/queries";
import type { UpcomingSlotGroup } from "@/app/api/public/[slug]/upcoming-slots/route";
import { useBookingSelection } from "./_components/booking-selection";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Step = "service" | "quickpick" | "calendar" | "details";

const DEFAULT_BRAND = "#b86b8c";

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
    <div className="mb-8 flex items-center justify-center" dir="ltr">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <Fragment key={s.id}>
            <div className="flex w-16 flex-col items-center gap-1.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold transition-all"
                style={
                  active
                    ? { background: brandGrd, color: "white", boxShadow: `0 8px 18px -6px ${brandColor}99`, transform: "scale(1.05)" }
                    : done
                    ? { background: `${brandColor}1f`, color: brandColor, border: `1px solid ${brandColor}55` }
                    : { background: "#f5f1f3", color: "#b3a8b0", border: "1px solid var(--border)" }
                }
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className="text-center text-xs"
                style={active ? { fontWeight: 700, color: "var(--foreground)" } : { color: "var(--muted)" }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mb-5 h-1 w-10 flex-shrink-0 overflow-hidden rounded-full" style={{ background: "#ece4e8" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: i < currentIdx ? "100%" : "0%", background: brandGrd }}
                />
              </div>
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
      className="group flex h-full w-full flex-col gap-3 overflow-hidden rounded-[1.3rem] p-4 text-right transition-all hover:-translate-y-0.5"
      style={{
        border: `1.5px solid ${selected ? brandColor : "var(--border)"}`,
        background: selected ? `${brandColor}0a` : "white",
        boxShadow: selected ? `0 12px 28px -12px ${brandColor}77` : "0 4px 14px -8px rgba(124,58,97,0.12)",
      }}
    >
      {/* Top: title + description (text gets priority) · selected indicator */}
      <div className="flex w-full items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-2 break-words text-[0.95rem] font-bold leading-snug text-[var(--foreground)]">
            {service.name}
          </p>
          {service.description && (
            <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-[var(--muted)]">
              {service.description}
            </p>
          )}
        </div>
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
          style={{ borderColor: selected ? brandColor : "#d1d5db", background: selected ? brandColor : "transparent" }}
        >
          {selected && <Check className="h-3.5 w-3.5 text-white" />}
        </span>
      </div>

      {/* Bottom: duration + price badges, pinned to the card base */}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background-alt)] px-2.5 py-0.5 text-xs text-[var(--muted)] whitespace-nowrap">
          <Clock className="h-3 w-3 shrink-0" />
          {service.durationMinutes} דקות
        </span>
        {showPrices && (
          <span
            className="display-num inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold transition-colors whitespace-nowrap"
            style={{ background: selected ? brandColor : `${brandColor}18`, color: selected ? "white" : brandColor }}
            dir="ltr"
          >
            ₪{Number(service.price).toLocaleString("he-IL")}
          </span>
        )}
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

function SuccessView({
  serviceName,
  date,
  time,
  businessName,
  serviceDuration,
  onReset,
  brandColor,
}: {
  serviceName?: string;
  date: string;
  time: string;
  businessName: string;
  serviceDuration?: number;
  onReset: () => void;
  brandColor: string;
}) {
  const formattedDate = formatDateHebrew(date);
  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;

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
          העברנו את הפרטים ל{businessName}. תקבלי עדכון לאחר אישור התור.
        </p>
      </div>

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
  showPrices = true,
  initialServiceId = "",
  businessName,
  brandColor = DEFAULT_BRAND,
}: {
  slug: string;
  services: PublicService[];
  showPrices?: boolean;
  initialServiceId?: string;
  businessName: string;
  brandColor?: string;
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
    setSelection({
      serviceName: svc.name,
      date: selectedDate,
      time: selectedTime,
      active: true,
    });
  }, [
    step,
    selectedServiceId,
    selectedDate,
    selectedTime,
    services,
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
        serviceDuration={selectedService?.durationMinutes}
        onReset={() => window.location.reload()}
        brandColor={brandColor}
      />
    );
  }

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

          <p className="text-center text-xs text-[var(--muted)] leading-5">
            הבקשה תישלח לעסק לאישור. התור יאושר רק אחרי שהעסק יאשר אותו.
          </p>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ background: `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)` }}
          >
            {pending ? "שולח…" : "שליחת בקשה לתור ✓"}
          </button>

          <div className="flex justify-end">
            <BackBtn onClick={() => setStep("quickpick")} />
          </div>
        </div>
      )}
    </form>
  );
}
