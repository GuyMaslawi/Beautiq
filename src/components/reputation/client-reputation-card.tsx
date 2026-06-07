"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, MessageSquareHeart, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REPUTATION } from "@/lib/constants/he";
import {
  generateThankyouMessage,
  generateReviewRequestMessage,
} from "@/lib/reputation/messages";

type ActivePanel = "thankyou" | "review" | null;

interface ClientReputationCardProps {
  clientName: string;
  serviceName: string;
  businessName: string;
  isToday: boolean;
}

export function ClientReputationCard({
  clientName,
  serviceName,
  businessName,
  isToday,
}: ClientReputationCardProps) {
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
        <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: "#b86b8c" }} />
        <p className="text-foreground font-semibold text-sm">
          {REPUTATION.clientCard.title}
        </p>
      </div>
      <p className="text-muted text-sm leading-relaxed">{REPUTATION.clientCard.body}</p>

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
                ? `✓ ${REPUTATION.clientCard.copied}`
                : REPUTATION.clientCard.copyButton}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setActivePanel(null)}>
              {REPUTATION.clientCard.close}
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
          {REPUTATION.clientCard.thankyouAction}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => toggle("review")}
        >
          <Star className="h-3.5 w-3.5" />
          {REPUTATION.clientCard.reviewAction}
        </Button>
        <Link href="/reputation">
          <Button size="sm" variant="ghost" className="text-muted">
            {REPUTATION.clientCard.goToReputation}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
