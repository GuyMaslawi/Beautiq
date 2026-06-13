"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { BOOKINGS } from "@/lib/constants/he";
import type { BookingFormState } from "@/server/bookings/actions";

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
}

const INITIAL: BookingFormState = {};

const selectClass =
  "bg-surface border-border text-foreground h-11 w-full appearance-none rounded-xl border px-4 text-base outline-none transition-colors focus:border-primary";

function getLocalTodayStr(): string {
  // Client-side: use Intl so it matches Israel timezone even for international users
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(
    new Date(),
  );
}

export function BookingForm({
  action,
  services,
  initialClientName,
  initialClientPhone,
}: {
  action: (
    prevState: BookingFormState,
    formData: FormData,
  ) => Promise<BookingFormState>;
  services: ServiceOption[];
  initialClientName?: string;
  initialClientPhone?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const todayStr = getLocalTodayStr();

  const [fields, setFields] = useState({
    clientName: initialClientName ?? "",
    phone: initialClientPhone ?? "",
    serviceId: "",
    date: todayStr,
    startTime: "",
    notes: "",
  });

  // Available slots fetched from /api/owner/slots
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  // Key whose slots are currently loaded; loading is derived from it below.
  const [loadedSlotsKey, setLoadedSlotsKey] = useState("");
  // Track the last fetch key to discard stale responses
  const fetchKeyRef = useRef("");

  // Sync fields from server state after validation error
  const [prevServerValues, setPrevServerValues] = useState(state.values);
  if (prevServerValues !== state.values && state.values) {
    setPrevServerValues(state.values);
    setFields((prev) => ({
      clientName: state.values?.clientName ?? prev.clientName,
      phone: state.values?.phone ?? prev.phone,
      serviceId: state.values?.serviceId ?? prev.serviceId,
      date: state.values?.date ?? prev.date,
      startTime: state.values?.startTime ?? prev.startTime,
      notes: state.values?.notes ?? prev.notes,
    }));
  }

  // Clear slots during render (not in an effect) when service/date is
  // incomplete, to avoid a cascading-render setState-in-effect.
  const slotsKey =
    fields.serviceId && fields.date ? `${fields.date}|${fields.serviceId}` : "";
  const [prevSlotsKey, setPrevSlotsKey] = useState(slotsKey);
  if (prevSlotsKey !== slotsKey) {
    setPrevSlotsKey(slotsKey);
    if (!slotsKey) {
      setAvailableSlots(null);
    }
  }
  const isFetchingSlots = slotsKey !== "" && slotsKey !== loadedSlotsKey;

  // Fetch available slots whenever serviceId or date changes
  useEffect(() => {
    if (!fields.serviceId || !fields.date) {
      return;
    }

    const key = `${fields.date}|${fields.serviceId}`;
    fetchKeyRef.current = key;

    fetch(
      `/api/owner/slots?date=${encodeURIComponent(fields.date)}&serviceId=${encodeURIComponent(fields.serviceId)}`,
    )
      .then((r) => r.json())
      .then((data: { slots?: string[] }) => {
        if (fetchKeyRef.current !== key) return; // stale response, discard
        const slots = data.slots ?? [];
        setAvailableSlots(slots);
        setLoadedSlotsKey(key);
        // Reset startTime to first available slot, or clear if none
        setFields((prev) => ({
          ...prev,
          startTime:
            slots.length > 0
              ? slots.includes(prev.startTime)
                ? prev.startTime
                : slots[0]
              : "",
        }));
      })
      .catch(() => {
        if (fetchKeyRef.current !== key) return;
        setLoadedSlotsKey(key);
        setAvailableSlots([]);
      });
  }, [fields.serviceId, fields.date]);

  const set = (field: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));

  const selectedService = services.find((s) => s.id === fields.serviceId);

  if (services.length === 0) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-foreground font-medium">
          {BOOKINGS.form.serviceNoActive}
        </p>
        <Link href="/services/new">
          <Button variant="secondary" size="sm">
            {BOOKINGS.form.serviceNoActiveCta}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-0" noValidate>
      {state.formError && (
        <div className="mb-6">
          <Alert>{state.formError}</Alert>
        </div>
      )}

      {/* Section 1 — Client details */}
      <div className="space-y-5 pb-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.form.sectionClient}
        </p>
        <Field
          label={BOOKINGS.form.clientNameLabel}
          htmlFor="clientName"
          error={state.errors?.clientName}
        >
          <Input
            id="clientName"
            name="clientName"
            placeholder={BOOKINGS.form.clientNamePlaceholder}
            value={fields.clientName}
            onChange={(e) => set("clientName")(e.target.value)}
            autoFocus
          />
        </Field>
        <Field
          label={BOOKINGS.form.phoneLabel}
          htmlFor="phone"
          error={state.errors?.phone}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={BOOKINGS.form.phonePlaceholder}
            value={fields.phone}
            onChange={(e) => set("phone")(e.target.value)}
            dir="ltr"
          />
          <p className="text-muted mt-1.5 text-xs">
            {BOOKINGS.form.clientPhoneHelper}
          </p>
        </Field>
      </div>

      <div className="border-border border-t" />

      {/* Section 2 — Service */}
      <div className="space-y-5 py-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.form.sectionService}
        </p>
        <Field
          label={BOOKINGS.form.serviceLabel}
          htmlFor="serviceId"
          error={state.errors?.serviceId}
        >
          <select
            id="serviceId"
            name="serviceId"
            value={fields.serviceId}
            onChange={(e) => set("serviceId")(e.target.value)}
            className={selectClass}
          >
            <option value="">{BOOKINGS.form.servicePlaceholder}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Service summary */}
        {selectedService && (
          <div className="bg-surface border-border rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-foreground text-sm font-semibold">
                  {selectedService.name}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <span className="text-muted text-xs">
                  {BOOKINGS.form.serviceSummaryDuration}
                </span>
                <span className="text-foreground mr-1 text-sm font-medium">
                  {selectedService.durationMinutes} {BOOKINGS.form.serviceDuration}
                </span>
              </div>
              {Number(selectedService.price) > 0 && (
                <div>
                  <span className="text-muted text-xs">
                    {BOOKINGS.form.serviceSummaryPrice}
                  </span>
                  <span className="text-foreground mr-1 text-sm font-medium">
                    {BOOKINGS.form.servicePrice}
                    {Number(selectedService.price).toLocaleString("he-IL")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-border border-t" />

      {/* Section 3 — Date & time */}
      <div className="space-y-5 py-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.form.sectionDateTime}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={BOOKINGS.form.dateLabel}
            htmlFor="date"
            error={state.errors?.date}
          >
            <Input
              id="date"
              name="date"
              type="date"
              min={todayStr}
              value={fields.date}
              onChange={(e) => set("date")(e.target.value)}
            />
          </Field>
          <Field
            label={BOOKINGS.form.startTimeLabel}
            htmlFor="startTime"
            error={state.errors?.startTime}
          >
            {isFetchingSlots ? (
              <div
                className={`${selectClass} flex items-center`}
                style={{ color: "var(--muted)" }}
              >
                {BOOKINGS.form.loadingSlots}
              </div>
            ) : !fields.serviceId ? (
              <select
                id="startTime"
                name="startTime"
                value={fields.startTime}
                disabled
                className={selectClass}
                style={{ opacity: 0.5 }}
              >
                <option value="">{BOOKINGS.form.startTimePlaceholder}</option>
              </select>
            ) : availableSlots !== null && availableSlots.length === 0 ? (
              <>
                <input type="hidden" name="startTime" value="" />
                <div
                  className={`${selectClass} flex items-center`}
                  style={{ color: "var(--muted)" }}
                >
                  {BOOKINGS.form.noSlots}
                </div>
              </>
            ) : (
              <select
                id="startTime"
                name="startTime"
                value={fields.startTime}
                onChange={(e) => set("startTime")(e.target.value)}
                className={selectClass}
              >
                <option value="">{BOOKINGS.form.startTimePlaceholder}</option>
                {(availableSlots ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <p className="text-muted text-xs">{BOOKINGS.form.overlapHelper}</p>
      </div>

      <div className="border-border border-t" />

      {/* Section 4 — Notes */}
      <div className="space-y-4 py-6">
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          {BOOKINGS.form.sectionNotes}
        </p>
        <Textarea
          id="notes"
          name="notes"
          placeholder={BOOKINGS.detail.notesPlaceholder}
          rows={3}
          value={fields.notes}
          onChange={(e) => set("notes")(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="border-border space-y-3 border-t pt-6">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? BOOKINGS.form.saving : BOOKINGS.form.saveButton}
        </Button>
        <div className="text-center">
          <Link
            href="/bookings"
            className="text-muted hover:text-foreground text-sm transition-colors"
          >
            {BOOKINGS.form.backLink}
          </Link>
        </div>
      </div>
    </form>
  );
}
