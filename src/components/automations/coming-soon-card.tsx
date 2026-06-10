"use client";

import { Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface ComingSoonCardProps {
  title: string;
  description: string;
}

export function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  return (
    <div
      className="flex flex-col rounded-2xl p-4 gap-2.5 opacity-60"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Title + switch in one row */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
          {title}
        </h3>
        <Switch
          checked={false}
          onCheckedChange={() => {}}
          disabled
          aria-label={title}
        />
      </div>

      {/* Status */}
      <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        בקרוב
      </p>

      {/* Description */}
      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        {description}
      </p>

      {/* Settings button (disabled) */}
      <button
        type="button"
        disabled
        className="mt-1 flex items-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium cursor-not-allowed"
        style={{
          background: "var(--background-alt)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
        }}
      >
        <Settings className="h-4 w-4" />
        הגדרות
      </button>
    </div>
  );
}
