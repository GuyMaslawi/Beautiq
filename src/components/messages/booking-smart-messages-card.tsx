"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MESSAGES } from "@/lib/constants/he";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  generateMessage,
  type MessageScenario,
  type MessageTone,
} from "@/lib/messages/smart-message-generator";
import { CopyMessageButton } from "@/components/messages/copy-message-button";

type BookingStatus =
  | "pending"
  | "approved"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

interface BookingSmartMessagesCardProps {
  businessName: string;
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  price?: string;
  bookingStatus: BookingStatus;
}

const TONES: MessageTone[] = ["regular", "warm", "concise"];

/**
 * The most relevant scenario to pre-select for a given status, so the owner
 * lands on the right message immediately — critically, the cancellation
 * message stays available and pre-selected after a booking is cancelled.
 */
function defaultScenarioFor(status: BookingStatus): MessageScenario | null {
  if (status === "cancelled") return "booking_cancelled";
  if (status === "no_show") return "no_show_followup";
  if (status === "completed") return "after_treatment";
  return null;
}

export function BookingSmartMessagesCard({
  businessName,
  clientName,
  clientPhone,
  serviceName,
  bookingDate,
  bookingTime,
  price,
  bookingStatus,
}: BookingSmartMessagesCardProps) {
  const [activeScenario, setActiveScenario] = useState<MessageScenario | null>(
    defaultScenarioFor(bookingStatus),
  );
  const [tone, setTone] = useState<MessageTone>("regular");

  const context = {
    businessName,
    clientName,
    serviceName,
    bookingDate,
    bookingTime,
    price,
  };

  // Build contextual scenario list based on booking status
  const scenarios: { value: MessageScenario; label: string }[] = [];

  if (bookingStatus !== "cancelled" && bookingStatus !== "no_show") {
    scenarios.push({
      value: "booking_confirmation",
      label: MESSAGES.smartComposer.scenarios.booking_confirmation,
    });
    scenarios.push({
      value: "booking_reminder",
      label: MESSAGES.smartComposer.scenarios.booking_reminder,
    });
  }

  // The cancellation message must remain available AFTER the booking is
  // cancelled — otherwise a cancelled appointment becomes a silent cancellation.
  if (
    bookingStatus === "pending" ||
    bookingStatus === "approved" ||
    bookingStatus === "cancelled"
  ) {
    scenarios.push({
      value: "booking_cancelled",
      label: MESSAGES.smartComposer.scenarios.booking_cancelled,
    });
  }

  if (bookingStatus === "completed") {
    scenarios.push({
      value: "after_treatment",
      label: MESSAGES.smartComposer.scenarios.after_treatment,
    });
  }

  if (bookingStatus === "no_show") {
    scenarios.push({
      value: "no_show_followup",
      label: MESSAGES.smartComposer.scenarios.no_show_followup,
    });
  }

  if (scenarios.length === 0) return null;

  const result =
    activeScenario ? generateMessage(activeScenario, context, tone) : null;

  return (
    <Card className="space-y-4 p-5">
      <p className="text-muted text-xs font-semibold uppercase tracking-wider">
        {MESSAGES.bookingMessagesSection}
      </p>

      {/* Scenario buttons */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setActiveScenario(s.value);
              setTone("regular");
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeScenario === s.value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted bg-transparent hover:border-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      {result && (
        <div className="space-y-3">
          {/* Tone selector */}
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

          {/* Message body */}
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
              {clientPhone && (() => {
                const waUrl = buildWhatsAppUrl(clientPhone, result.body);
                return waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #25d366 0%, #1ab954 100%)" }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {MESSAGES.smartComposer.sendWhatsApp}
                  </a>
                ) : null;
              })()}
              <CopyMessageButton
                message={result.body}
                label={MESSAGES.smartComposer.copyButton}
              />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
