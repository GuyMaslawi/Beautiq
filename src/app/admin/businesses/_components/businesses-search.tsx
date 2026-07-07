"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "כל הסטטוסים" },
  { value: "trial", label: "בתקופת ניסיון" },
  { value: "active", label: "פעיל" },
  { value: "discounted", label: "בהנחה" },
  { value: "suspended", label: "מושהה" },
  { value: "cancelled", label: "בוטל" },
  { value: "pending_payment", label: "ממתין לתשלום" },
];

const PLAN_OPTIONS = [
  { value: "", label: "כל התוכניות" },
  { value: "basic", label: "בסיס ₪149" },
  { value: "pro", label: "פרו ₪199" },
];

interface Props {
  defaultQ: string;
  defaultStatus: string;
  defaultPlan: string;
}

const fieldClass =
  "h-9 rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-light hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20";

export function BusinessesSearch({ defaultQ, defaultStatus, defaultPlan }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const q = (data.get("q") as string)?.trim();
    const status = data.get("status") as string;
    const plan = data.get("plan") as string;
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    startTransition(() => {
      router.push(`/admin/businesses?${params.toString()}`);
    });
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={defaultQ}
        placeholder="חיפוש לפי שם עסק, בעלים, אימייל, טלפון..."
        className={`${fieldClass} min-w-[280px] flex-1`}
        autoComplete="off"
      />
      <select
        name="status"
        defaultValue={defaultStatus}
        onChange={handleSelectChange}
        className={fieldClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        name="plan"
        defaultValue={defaultPlan}
        onChange={handleSelectChange}
        className={fieldClass}
      >
        {PLAN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-gradient h-9 rounded-xl px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "מחפש..." : "חיפוש"}
      </button>
    </form>
  );
}
