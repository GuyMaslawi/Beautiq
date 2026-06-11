"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
        className="h-9 min-w-[320px] flex-1 rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[#1a1a2e]/20"
        style={{
          background: "#fff",
          borderColor: "rgba(0,0,0,0.12)",
          color: "#1a1a2e",
        }}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={isPending}
        className="h-9 rounded-xl px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "#1a1a2e" }}
      >
        {isPending ? "מחפש..." : "חיפוש"}
      </button>
      {defaultQ && (
        <a
          href="/admin/clients"
          className="h-9 flex items-center rounded-xl px-3 text-sm font-medium transition-colors"
          style={{ background: "#f3f4f6", color: "#555" }}
        >
          ניקוי ✕
        </a>
      )}
    </form>
  );
}
