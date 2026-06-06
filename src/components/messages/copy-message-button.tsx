"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/constants/he";

interface CopyMessageButtonProps {
  message: string;
  label: string;
}

export function CopyMessageButton({ message, label }: CopyMessageButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setShowFallback(true);
      }
    } catch {
      setShowFallback(true);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        className="w-full justify-start"
      >
        {copied ? `✓ ${MESSAGES.copySuccess}` : label}
      </Button>
      {showFallback && (
        <div className="space-y-1.5">
          <p className="text-muted text-xs">{MESSAGES.copyFallbackNote}</p>
          <textarea
            readOnly
            value={message}
            rows={4}
            className="border-border bg-background text-foreground w-full rounded-lg border p-2.5 text-sm leading-relaxed"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            dir="rtl"
          />
        </div>
      )}
    </div>
  );
}
