"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleServiceActiveAction } from "@/server/services/actions";
import { SERVICES } from "@/lib/constants/he";

export function ToggleServiceButton({
  serviceId,
  isActive,
}: {
  serviceId: string;
  isActive: boolean;
}) {
  const [enabled, setEnabled] = useState(isActive);
  const [error, setError] = useState(false);
  const [isToggling, startToggle] = useTransition();

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    setError(false);
    startToggle(async () => {
      const result = await toggleServiceActiveAction(serviceId, next);
      if (!result.success) {
        setEnabled(!next);
        setError(true);
        setTimeout(() => setError(false), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isToggling}
        aria-label={enabled ? "כיבוי שירות" : "הפעלת שירות"}
      />
      <span
        className="text-xs font-semibold"
        style={{ color: enabled ? "#16a34a" : "var(--muted)" }}
      >
        {enabled ? SERVICES.card.active : SERVICES.card.inactive}
      </span>
      {error && (
        <span className="mt-0.5 text-xs" style={{ color: "#dc2626" }}>
          {SERVICES.card.toggleError}
        </span>
      )}
    </div>
  );
}
