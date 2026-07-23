"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

interface Props {
  defaultQ: string;
}

export function AdminClientsSearch({ defaultQ }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams();
    const q = (data.get("q") as string)?.trim();
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(`/admin/clients?${params.toString()}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        name="q"
        defaultValue={defaultQ}
        placeholder="חיפוש לפי שם לקוחה, טלפון, או שם עסק..."
        className="h-9 w-full flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-light hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-auto sm:min-w-[320px]"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-gradient h-9 rounded-xl px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "מחפש..." : "חיפוש"}
      </button>
      {defaultQ && (
        <a
          href="/admin/clients"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:bg-background-alt hover:text-foreground"
        >
          ניקוי
          <X className="h-3.5 w-3.5" />
        </a>
      )}
    </form>
  );
}
