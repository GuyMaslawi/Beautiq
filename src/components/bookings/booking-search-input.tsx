"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface BookingSearchInputProps {
  initialValue: string;
  /** All other current URL params (excluding "q"), pre-serialized by the server page */
  otherParams: string;
}

export function BookingSearchInput({ initialValue, otherParams }: BookingSearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(otherParams);
      const trimmed = value.trim();
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      router.push(`/bookings?${params.toString()}`);
    }, 420);
    return () => clearTimeout(timer);
  }, [value, otherParams, router]);

  return (
    <div className="relative w-full max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4"
        style={{ color: "var(--muted)", insetInlineEnd: "0.75rem" }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="חיפוש לפי שם לקוחה או טלפון..."
        dir="rtl"
        className="w-full rounded-xl border py-2 ps-4 pe-9 text-sm transition-colors focus:outline-none focus:ring-2"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          "--tw-ring-color": "rgba(184,107,140,0.40)",
        } as React.CSSProperties}
      />
    </div>
  );
}
