"use client";

import { useState } from "react";
import { Copy, ExternalLink, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBLIC_PAGE } from "@/lib/constants/he";

export function PublicLinkPreview({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/b/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        {PUBLIC_PAGE.preview.description}
      </p>

      <div
        className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-surface px-3 py-2"
        dir="ltr"
      >
        <span suppressHydrationWarning className="flex-1 truncate text-sm text-[var(--muted)] font-mono">
          {typeof window !== "undefined" ? `${window.location.origin}/b/${slug}` : `/b/${slug}`}
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="flex-1"
        >
          {copied ? (
            <>
              <CheckCheck className="h-4 w-4 text-green-600" />
              {PUBLIC_PAGE.preview.copied}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              {PUBLIC_PAGE.preview.copyButton}
            </>
          )}
        </Button>

        <a
          href={`/b/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-surface px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background-alt)] transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          {PUBLIC_PAGE.preview.openButton}
        </a>
      </div>
    </div>
  );
}
