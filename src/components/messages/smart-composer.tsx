"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MESSAGES } from "@/lib/constants/he";
import {
  generateMessage,
  type MessageScenario,
  type MessageTone,
  type GeneratorContext,
} from "@/lib/messages/smart-message-generator";
import { CopyMessageButton } from "@/components/messages/copy-message-button";
import type { ComposerBookingOption, ComposerClientOption } from "@/server/messages/queries";

const SCENARIOS: { value: MessageScenario; label: string }[] = [
  { value: "booking_confirmation", label: MESSAGES.smartComposer.scenarios.booking_confirmation },
  { value: "booking_reminder", label: MESSAGES.smartComposer.scenarios.booking_reminder },
  { value: "booking_cancelled", label: MESSAGES.smartComposer.scenarios.booking_cancelled },
  { value: "booking_rescheduled", label: MESSAGES.smartComposer.scenarios.booking_rescheduled },
  { value: "after_treatment", label: MESSAGES.smartComposer.scenarios.after_treatment },
  { value: "rebook_reminder", label: MESSAGES.smartComposer.scenarios.rebook_reminder },
  { value: "no_show_followup", label: MESSAGES.smartComposer.scenarios.no_show_followup },
  { value: "not_returned", label: MESSAGES.smartComposer.scenarios.not_returned },
];

const TONES: MessageTone[] = ["regular", "warm", "concise"];

// Scenarios that benefit from booking context
const BOOKING_SCENARIOS = new Set<MessageScenario>([
  "booking_confirmation",
  "booking_reminder",
  "booking_cancelled",
  "booking_rescheduled",
  "after_treatment",
]);

// Scenarios that use client-only context (no booking needed)
const CLIENT_SCENARIOS = new Set<MessageScenario>([
  "rebook_reminder",
  "no_show_followup",
  "not_returned",
]);

interface SmartComposerProps {
  businessName: string;
  bookings: ComposerBookingOption[];
  clients: ComposerClientOption[];
}

export function SmartComposer({ businessName, bookings, clients }: SmartComposerProps) {
  const [scenario, setScenario] = useState<MessageScenario | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [clientId, setClientId] = useState("");
  const [tone, setTone] = useState<MessageTone>("regular");

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === bookingId) ?? null,
    [bookings, bookingId],
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const result = useMemo(() => {
    if (!scenario) return null;

    let context: GeneratorContext = { businessName };

    if (selectedBooking) {
      context = {
        ...context,
        clientName: selectedBooking.clientName,
        serviceName: selectedBooking.serviceName,
        bookingDate: selectedBooking.bookingDate,
        bookingTime: selectedBooking.bookingTime,
        price: selectedBooking.price,
      };
    } else if (selectedClient) {
      context = { ...context, clientName: selectedClient.clientName };
    }

    return generateMessage(scenario, context, tone);
  }, [scenario, selectedBooking, selectedClient, tone, businessName]);

  const needsBooking = scenario ? BOOKING_SCENARIOS.has(scenario) : false;
  const needsClient = scenario ? CLIENT_SCENARIOS.has(scenario) : false;

  function handleReset() {
    setScenario(null);
    setBookingId("");
    setClientId("");
    setTone("regular");
  }

  return (
    <Card className="space-y-5 p-5">
      {/* Header */}
      <div>
        <p className="text-foreground text-sm font-semibold">
          {MESSAGES.smartComposer.sectionTitle}
        </p>
        <p className="text-muted mt-0.5 text-xs">
          {MESSAGES.smartComposer.sectionSubtitle}
        </p>
      </div>

      {/* Scenario selector */}
      <div>
        <p className="text-muted mb-2 text-xs font-semibold">
          {MESSAGES.smartComposer.scenarioLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setScenario(s.value);
                setBookingId("");
                setClientId("");
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                scenario === s.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted bg-transparent hover:border-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Booking selector */}
      {needsBooking && (
        <div>
          <p className="text-muted mb-1.5 text-xs font-semibold">
            {MESSAGES.smartComposer.bookingLabel}
          </p>
          {bookings.length === 0 ? (
            <p className="text-muted text-xs">
              {MESSAGES.smartComposer.noBookingsAvailable}
            </p>
          ) : (
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              dir="rtl"
              className="border-border bg-background text-foreground w-full rounded-lg border p-2.5 text-sm"
            >
              <option value="">{MESSAGES.smartComposer.bookingPlaceholder}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Client selector */}
      {needsClient && (
        <div>
          <p className="text-muted mb-1.5 text-xs font-semibold">
            {MESSAGES.smartComposer.clientLabel}
          </p>
          {clients.length === 0 ? (
            <p className="text-muted text-xs">
              {MESSAGES.smartComposer.noClientsAvailable}
            </p>
          ) : (
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              dir="rtl"
              className="border-border bg-background text-foreground w-full rounded-lg border p-2.5 text-sm"
            >
              <option value="">{MESSAGES.smartComposer.clientPlaceholder}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Tone selector + preview */}
      {result && (
        <div className="space-y-3">
          {/* Tone */}
          <div className="flex items-center gap-2">
            <p className="text-muted text-xs font-semibold">
              {MESSAGES.smartComposer.toneLabel}
            </p>
            <div className="flex gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    tone === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted bg-transparent hover:text-foreground"
                  }`}
                >
                  {MESSAGES.smartComposer.tones[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Missing context */}
          {result.missingContext.length > 0 ? (
            <div className="border-border bg-surface rounded-lg border p-3">
              {result.missingContext.map((msg) => (
                <p key={msg} className="text-muted text-sm">
                  {msg}
                </p>
              ))}
            </div>
          ) : result.body ? (
            <div className="space-y-3">
              <p className="text-muted text-xs font-semibold">
                {MESSAGES.smartComposer.previewTitle}
              </p>
              <div className="border-border bg-surface rounded-lg border p-3">
                <p
                  className="text-foreground whitespace-pre-line text-sm leading-relaxed"
                  dir="rtl"
                >
                  {result.body}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <CopyMessageButton
                    message={result.body}
                    label={MESSAGES.smartComposer.copyButton}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-muted hover:text-foreground text-xs"
                >
                  {MESSAGES.smartComposer.resetButton}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
