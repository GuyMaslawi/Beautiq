"use client";

// 15-minute time options from 06:00 to 23:00 — covers all typical beauty business hours
const OPTIONS: { value: string; label: string }[] = [];
for (let h = 6; h <= 23; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    OPTIONS.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
  }
}

interface TimeSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  className?: string;
}

export function TimeSelect({
  id,
  name,
  value,
  onChange,
  hasError,
  className = "",
}: TimeSelectProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "bg-surface border-border text-foreground",
        "h-10 rounded-xl border px-3 text-sm",
        "outline-none transition-colors focus:border-primary",
        hasError ? "border-red-400" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <option value="">בחירה…</option>
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
