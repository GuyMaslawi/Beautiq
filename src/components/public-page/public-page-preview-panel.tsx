"use client";

import { useState } from "react";
import { Monitor, Smartphone, RefreshCw } from "lucide-react";

interface PublicPagePreviewPanelProps {
  slug: string;
}

export function PublicPagePreviewPanel({ slug }: PublicPagePreviewPanelProps) {
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [key, setKey] = useState(0); // force iframe reload

  const url = `/b/${slug}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2" dir="rtl">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          כך הלקוחות רואים את העמוד שלך. כל שינוי שתשמרי מתעדכן כאן.
        </p>

        <div className="flex items-center gap-2 shrink-0">
          {/* Reload */}
          <button
            onClick={() => setKey((k) => k + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--background-alt)]"
            style={{ borderColor: "var(--border)" }}
            title="רענון"
          >
            <RefreshCw className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
          </button>

          {/* View toggle */}
          <div
            className="flex rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setMode("mobile")}
              className="flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors"
              style={{
                background: mode === "mobile" ? "rgba(172,92,127,0.10)" : "transparent",
                color: mode === "mobile" ? "#ac5c7f" : "var(--foreground-soft)",
              }}
            >
              <Smartphone className="h-3.5 w-3.5" />
              מובייל
            </button>
            <button
              onClick={() => setMode("desktop")}
              className="flex h-8 items-center gap-1.5 border-r px-3 text-xs font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                background: mode === "desktop" ? "rgba(172,92,127,0.10)" : "transparent",
                color: mode === "desktop" ? "#ac5c7f" : "var(--foreground-soft)",
              }}
            >
              <Monitor className="h-3.5 w-3.5" />
              דסקטופ
            </button>
          </div>
        </div>
      </div>

      {/* Preview frame */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--border)",
          background: "#f0f0f0",
          boxShadow: "0 2px 12px rgba(43,37,48,0.08)",
        }}
      >
        {mode === "mobile" ? (
          /* Mobile frame */
          <div className="flex justify-center py-6 px-4">
            <div
              className="relative overflow-hidden rounded-[2.5rem] border-[8px]"
              style={{
                width: 375,
                height: 650,
                borderColor: "#2b2530",
                background: "#fff",
                boxShadow: "0 8px 32px rgba(43,37,48,0.25)",
              }}
            >
              {/* Notch */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 z-20 rounded-b-2xl"
                style={{ width: 120, height: 28, background: "#2b2530" }}
              />
              {/* Screen */}
              <iframe
                key={key}
                src={url}
                className="absolute inset-0 w-full h-full"
                style={{ border: "none" }}
                title="תצוגה מקדימה של עמוד לקוחות — מובייל"
              />
            </div>
          </div>
        ) : (
          /* Desktop frame */
          <div className="relative" style={{ height: 600 }}>
            {/* Browser chrome */}
            <div
              className="flex items-center gap-2 px-4 py-2 border-b"
              style={{
                background: "#fff",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div
                className="mx-auto h-6 min-w-0 max-w-sm flex-1 truncate rounded-md px-3 text-center font-mono text-xs leading-6"
                style={{
                  background: "rgba(43,37,48,0.06)",
                  color: "var(--muted)",
                }}
                dir="ltr"
              >
                {typeof window !== "undefined" ? `${window.location.origin}${url}` : url}
              </div>
            </div>
            <iframe
              key={key}
              src={url}
              className="w-full"
              style={{ height: "calc(100% - 40px)", border: "none" }}
              title="תצוגה מקדימה של עמוד לקוחות — דסקטופ"
            />
          </div>
        )}
      </div>
    </div>
  );
}
