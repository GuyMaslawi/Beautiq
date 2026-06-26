"use client";

import { useState } from "react";
import { SETTINGS } from "@/lib/constants/he";
import { usePublicBusinessUrl } from "@/lib/use-public-business-url";

export function PublicLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  // Browser-aware booking link: the configured production domain when
  // NEXT_PUBLIC_APP_URL is set, otherwise the current origin so the copied link
  // works on localhost / preview deploys.
  const publicUrl = usePublicBusinessUrl(slug);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
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
