"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { brandGradient, getBusinessWhatsAppHref } from "./helpers";
import { WhatsAppIcon } from "./icons";

/**
 * Mobile-only sticky "book now" bar.
 * Hides itself while the booking card (#book) is on screen, and smoothly
 * scrolls + focuses the booking card when tapped. When the business has a
 * valid phone, a thumb-friendly WhatsApp action sits alongside.
 */
export function StickyBookingCta({
  brand,
  businessPhone,
  businessName,
}: {
  brand: string;
  businessPhone?: string | null;
  businessName?: string | null;
}) {
  const waHref = getBusinessWhatsAppHref(businessPhone, businessName);
  // Start hidden to avoid a flash before we know where the booking card is.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("book");
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function goToBooking() {
    const target = document.getElementById("book");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus for accessibility once the scroll settles.
    window.setTimeout(() => target.focus({ preventScroll: true }), 400);
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-6 transition-all duration-300 lg:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
      style={{
        background:
          "linear-gradient(to top, var(--background) 55%, transparent 100%)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={goToBooking}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98]"
          style={{
            background: brandGradient(brand),
            boxShadow: `0 12px 28px -10px ${brand}cc`,
          }}
        >
          <Sparkles className="h-4 w-4" />
          קביעת תור עכשיו
        </button>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-xl transition-opacity hover:opacity-90 active:scale-[.97]"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>
        )}
      </div>
    </div>
  );
}
