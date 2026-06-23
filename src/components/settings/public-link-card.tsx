"use client";

import { useEffect, useState } from "react";
import { SETTINGS } from "@/lib/constants/he";

export function PublicLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  // Resolve the absolute origin only after mount so server and client render
  // the same markup first (avoids a hydration mismatch), then upgrade to the
  // full shareable URL.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const publicUrl = `${origin}/b/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        typeof window !== "undefined"
          ? `${window.location.origin}/b/${slug}`
          : `/b/${slug}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access not available — silently ignore
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
          {SETTINGS.publicLink.active}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-[var(--muted)]">
        {SETTINGS.publicLink.body}
      </p>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <p className="mb-1 text-xs font-medium text-[var(--muted)]">
          {SETTINGS.publicLink.slugLabel}
        </p>
        <p className="break-all font-mono text-sm text-[var(--foreground)]" dir="ltr">
          {publicUrl}
        </p>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="bg-surface rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background)] active:scale-95"
      >
        {copied ? SETTINGS.publicLink.copied : SETTINGS.publicLink.copyButton}
      </button>
    </div>
  );
}
