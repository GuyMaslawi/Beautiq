"use client";

import { useActionState, useState } from "react";
import { Heart, Star } from "lucide-react";
import {
  submitPublicReviewAction,
  type PublicReviewFormState,
} from "@/server/public-booking/actions";

const INITIAL: PublicReviewFormState = {};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} כוכבים`}
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform hover:scale-110 focus:outline-none active:scale-95"
        >
          <Star
            className="h-7 w-7 transition-colors"
            fill={n <= value ? "#f59e0b" : "none"}
            stroke={n <= value ? "#f59e0b" : "#d1d5db"}
          />
        </button>
      ))}
    </div>
  );
}

export function PublicReviewForm({
  slug,
  brandColor,
}: {
  slug: string;
  brandColor: string;
}) {
  const boundAction = submitPublicReviewAction.bind(null, slug);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL);
  const [rating, setRating] = useState(5);

  const brandGrd = `linear-gradient(135deg, ${brandColor}cc 0%, ${brandColor} 100%)`;

  if (state.success) {
    return (
      <div className="rounded-2xl bg-green-50 px-5 py-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Heart className="h-5 w-5" fill="currentColor" />
        </span>
        <p className="font-semibold text-green-800 text-sm">תודה רבה על הביקורת!</p>
        <p className="text-xs text-green-600 mt-1">הביקורת שלך התקבלה בהצלחה.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {state.formError}
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="review-name"
          className="block text-sm font-medium text-[var(--foreground)]"
        >
          שמך
        </label>
        <input
          id="review-name"
          name="clientName"
          type="text"
          placeholder="מה השם שלך?"
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
        />
        {state.errors?.clientName && (
          <p className="text-xs text-red-500">{state.errors.clientName}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--foreground)]">דירוג</p>
        <StarPicker value={rating} onChange={setRating} />
        <input type="hidden" name="rating" value={rating} />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="review-text"
          className="block text-sm font-medium text-[var(--foreground)]"
        >
          הביקורת שלך
        </label>
        <textarea
          id="review-text"
          name="reviewText"
          rows={3}
          placeholder="ספרי לנו על החוויה שלך..."
          className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
        />
        {state.errors?.reviewText && (
          <p className="text-xs text-red-500">{state.errors.reviewText}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-60"
        style={{ background: brandGrd }}
      >
        {isPending ? "שולחת..." : "שליחת ביקורת"}
      </button>
    </form>
  );
}
