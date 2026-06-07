"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquareHeart, Star, CalendarDays, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReputationMessagePreview } from "@/components/reputation/reputation-message-preview";
import { REPUTATION } from "@/lib/constants/he";
import {
  generateThankyouMessage,
  generateReviewRequestMessage,
} from "@/lib/reputation/messages";
import type { ReputationBooking } from "@/server/reputation/queries";

type ActivePanel = "thankyou" | "review" | null;

interface ReputationBookingCardProps {
  booking: ReputationBooking;
  businessName: string;
  completedDateFormatted: string;
}

export function ReputationBookingCard({
  booking,
  businessName,
  completedDateFormatted,
}: ReputationBookingCardProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  function toggle(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const thankyouMessage = generateThankyouMessage({
    clientName: booking.clientName,
    serviceName: booking.serviceName,
    businessName,
    isToday: booking.isToday,
  });

  const reviewMessage = generateReviewRequestMessage({
    clientName: booking.clientName,
    businessName,
  });

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground font-semibold text-base leading-tight">
            {booking.clientName}
          </p>
          <p className="text-muted text-sm mt-0.5" dir="ltr">
            {booking.clientPhone}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: "rgba(61,139,110,0.08)",
            color: "#3d8b6e",
            border: "1px solid rgba(61,139,110,0.2)",
          }}
        >
          {REPUTATION.card.completedBadge}
        </span>
      </div>

      {/* Service + date */}
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">{booking.serviceName}</span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted shrink-0" />
          <span className="text-foreground">{completedDateFormatted}</span>
        </div>
        {booking.price > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted">{REPUTATION.card.price}:</span>
            <span className="text-foreground font-medium">
              ₪{booking.price.toLocaleString("he-IL")}
            </span>
          </div>
        )}
      </div>

      {/* Message panel */}
      {activePanel === "thankyou" && (
        <ReputationMessagePreview
          title={REPUTATION.message.thankyouTitle}
          message={thankyouMessage}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === "review" && (
        <ReputationMessagePreview
          title={REPUTATION.message.reviewTitle}
          message={reviewMessage}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => toggle("thankyou")}
        >
          <MessageSquareHeart className="h-3.5 w-3.5" />
          {REPUTATION.card.thankyouButton}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => toggle("review")}
        >
          <Star className="h-3.5 w-3.5" />
          {REPUTATION.card.reviewButton}
        </Button>
        <Link href={`/bookings/${booking.id}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            {REPUTATION.card.bookingDetails}
          </Button>
        </Link>
        <Link href={`/clients/${booking.clientId}`}>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted">
            <User className="h-3.5 w-3.5" />
            {REPUTATION.card.clientDetails}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
