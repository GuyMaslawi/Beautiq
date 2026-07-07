"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

interface Service {
  id: string;
  name: string;
}

type BookingStatusFilter = "all" | "pending" | "active" | "completed" | "cancelled";

const STATUS_LABELS: Record<BookingStatusFilter, string> = {
  all: "כל הסטטוסים",
  pending: "ממתינות לאישור",
  active: "פעילים",
  completed: "הושלמו",
  cancelled: "בוטלו",
};

interface BookingAdvancedFilterProps {
  services: Service[];
  currentStatus: BookingStatusFilter;
  currentServiceId: string | undefined;
  /** Serialized params for everything except status/serviceId (filter, q, sort, dir) */
  baseParams: string;
}

export function BookingAdvancedFilter({
  services,
  currentStatus,
  currentServiceId,
  baseParams,
}: BookingAdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const activeCount =
    (currentStatus !== "all" ? 1 : 0) +
    (currentServiceId ? 1 : 0);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(baseParams);
    const advanced: Record<string, string | undefined> = {
      status: currentStatus !== "all" ? currentStatus : undefined,
      serviceId: currentServiceId,
      ...overrides,
    };
    Object.entries(advanced).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return `/bookings?${params.toString()}`;
  }

  function navigate(url: string) {
    setOpen(false);
    router.push(url);
  }

  // Build chips for active advanced filters
  const chips: Array<{ label: string; clearUrl: string }> = [];
  if (currentStatus !== "all") {
    chips.push({ label: STATUS_LABELS[currentStatus], clearUrl: buildUrl({ status: undefined }) });
  }
  if (currentServiceId) {
    const svc = services.find((s) => s.id === currentServiceId);
    chips.push({ label: svc?.name ?? currentServiceId, clearUrl: buildUrl({ serviceId: undefined }) });
  }

  const isActive = open || activeCount > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Filter button + dropdown */}
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all"
          style={
            isActive
              ? {
                  background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(172,92,127,0.30)",
                  border: "1.5px solid transparent",
                }
              : {
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  color: "var(--muted)",
                }
          }
        >
          <SlidersHorizontal className="h-4 w-4" />
          סינון מתקדם
          {activeCount > 0 && (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.28)" }}
            >
              {activeCount}
            </span>
          )}
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {/* Popover panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl"
              style={{
                insetInlineStart: 0,
                top: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(43,37,48,0.14), 0 2px 8px rgba(43,37,48,0.08)",
              }}
            >
              <div className="space-y-5 p-4">
                {/* Status */}
                <FilterSection title="סטטוס תור">
                  {(["all", "pending", "active", "completed", "cancelled"] as BookingStatusFilter[]).map((s) => (
                    <FilterPill
                      key={s}
                      label={STATUS_LABELS[s]}
                      active={currentStatus === s}
                      onClick={() => navigate(buildUrl({ status: s !== "all" ? s : undefined }))}
                    />
                  ))}
                </FilterSection>

                {/* Service */}
                {services.length > 0 && (
                  <FilterSection title="שירות">
                    <FilterPill
                      label="כל השירותים"
                      active={!currentServiceId}
                      onClick={() => navigate(buildUrl({ serviceId: undefined }))}
                    />
                    {services.map((svc) => (
                      <FilterPill
                        key={svc.id}
                        label={svc.name}
                        active={currentServiceId === svc.id}
                        onClick={() => navigate(buildUrl({ serviceId: svc.id }))}
                      />
                    ))}
                  </FilterSection>
                )}

                {/* Clear all */}
                {activeCount > 0 && (
                  <div
                    className="border-t pt-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      onClick={() =>
                        navigate(buildUrl({ status: undefined, serviceId: undefined }))
                      }
                      className="w-full rounded-xl py-2 text-sm font-medium transition-opacity hover:opacity-75"
                      style={{ color: "#ac5c7f", background: "rgba(172,92,127,0.07)" }}
                    >
                      ניקוי כל הפילטרים
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: "rgba(172,92,127,0.35)",
                background: "rgba(172,92,127,0.08)",
                color: "#ac5c7f",
              }}
            >
              {chip.label}
              <button
                onClick={() => router.push(chip.clearUrl)}
                className="flex items-center transition-opacity hover:opacity-60"
                aria-label={`הסר פילטר: ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-medium transition-all hover:opacity-85"
      style={
        active
          ? {
              background: "linear-gradient(135deg, #c76f93 0%, #ac5c7f 100%)",
              borderColor: "transparent",
              color: "#fff",
            }
          : { borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }
      }
    >
      {label}
    </button>
  );
}
