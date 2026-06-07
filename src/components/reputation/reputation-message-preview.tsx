"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REPUTATION } from "@/lib/constants/he";

interface ReputationMessagePreviewProps {
  title: string;
  message: string;
  onClose: () => void;
}

export function ReputationMessagePreview({
  title,
  message,
  onClose,
}: ReputationMessagePreviewProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // clipboard unavailable — user can copy manually from the text below
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
      <p className="text-muted text-xs font-semibold uppercase tracking-wider">
        {title}
      </p>
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
        {message}
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
        <Button size="sm" variant="ghost" onClick={onClose}>
          {REPUTATION.message.close}
        </Button>
      </div>
    </div>
  );
}
