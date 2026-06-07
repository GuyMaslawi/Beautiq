"use client";

import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RETENTION } from "@/lib/constants/he";
import { generateRetentionMessage } from "@/lib/retention/messages";

interface ClientRetentionCardProps {
  clientName: string;
  businessName: string;
  lastServiceName?: string;
}

export function ClientRetentionCard({
  clientName,
  businessName,
  lastServiceName,
}: ClientRetentionCardProps) {
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);

  const message = generateRetentionMessage({
    clientName,
    businessName,
    serviceName: lastServiceName,
  });

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // silent — message is visible in the preview
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(201,120,152,0.12) 0%, rgba(184,107,140,0.08) 100%)",
          }}
        >
          <HeartHandshake className="h-4 w-4" style={{ color: "#b86b8c" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">
            {RETENTION.clientProfileCard.title}
          </p>
          <p className="text-muted text-xs mt-0.5 leading-relaxed">
            {RETENTION.clientProfileCard.body}
          </p>
        </div>
      </div>

      {showMessage && (
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
          <p className="text-muted text-xs font-semibold uppercase tracking-wider">
            {RETENTION.message.sectionTitle}
          </p>
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
            {message}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-center"
            onClick={handleCopy}
          >
            {copied
              ? `✓ ${RETENTION.message.copied}`
              : RETENTION.message.copyButton}
          </Button>
        </div>
      )}

      <Button
        size="sm"
        variant="secondary"
        className="w-full justify-center"
        onClick={() => setShowMessage((v) => !v)}
      >
        {showMessage
          ? RETENTION.message.close
          : RETENTION.clientProfileCard.action}
      </Button>
    </Card>
  );
}
