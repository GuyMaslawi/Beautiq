"use client";

import { useEffect, useState } from "react";
import { brandGradient } from "./helpers";

/**
 * Mobile-only sticky "book now" bar.
 * Hides itself while the booking card (#book) is on screen, and smoothly
 * scrolls + focuses the booking card when tapped.
 */
export function StickyBookingCta({ brand }: { brand: string }) {
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
      <button
        type="button"
        onClick={goToBooking}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-[.98]"
        style={{ background: brandGradient(brand) }}
      >
        קביעת תור עכשיו ✨
      </button>
    </div>
  );
}
