"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const fieldClass =
  "h-9 rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-light hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AccountsSearch({
  defaultQ,
  filter,
}: {
  defaultQ: string;
  filter: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const q = ((data.get("q") as string) ?? "").trim();
    const params = new URLSearchParams();
    // חיפוש לפי אימייל נועד למצוא חשבון ספציפי — ולכן הוא מתעלם מהסינון הנוכחי,
    // אחרת חיפוש של בעלת עסק שכבר משלמת בתוך "ממתינות לגישה" היה מחזיר ריק.
    params.set("filter", q ? "all" : filter);
    if (q) params.set("q", q);
    startTransition(() => router.push(`/admin/accounts?${params.toString()}`));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={defaultQ}
        placeholder="חיפוש לפי אימייל או שם..."
        className={`${fieldClass} min-w-[260px] flex-1`}
        autoComplete="off"
      />
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
