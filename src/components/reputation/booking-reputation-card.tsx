"use client";

import { useState } from "react";
import { BadgeCheck, MessageSquareHeart, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REPUTATION } from "@/lib/constants/he";
import {
  generateThankyouMessage,
  generateReviewRequestMessage,
} from "@/lib/reputation/messages";

type ActivePanel = "thankyou" | "review" | null;

interface BookingReputationCardProps {
  clientName: string;
  serviceName: string;
  businessName: string;
  isToday: boolean;
}

export function BookingReputationCard({
  clientName,
  serviceName,
  businessName,
  isToday,
}: BookingReputationCardProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [copied, setCopied] = useState(false);

  function toggle(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setCopied(false);
  }

  const thankyouMessage = generateThankyouMessage({
    clientName,
    serviceName,
    businessName,
    isToday,
  });

  const reviewMessage = generateReviewRequestMessage({ clientName, businessName });

  const activeMessage = activePanel === "thankyou" ? thankyouMessage : reviewMessage;
  const activeTitle =
    activePanel === "thankyou"
      ? REPUTATION.message.thankyouTitle
      : REPUTATION.message.reviewTitle;

  async function handleCopy() {
    if (!activeMessage) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(activeMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: "#ac5c7f" }} />
        <p className="text-muted text-xs font-semibold uppercase tracking-wider">
          מוניטין וביקורות
        </p>
      </div>

      {/* Active message panel */}
      {activePanel && (
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {activeTitle}
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
            {activeMessage}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 justify-center"
              onClick={handleCopy}
            >
              {copied
                ? `✓ ${REPUTATION.message.copied}`
                : REPUTATION.message.copyButton}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setActivePanel(null)}>
              {REPUTATION.message.close}
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
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
      </div>
    </Card>
  );
}
