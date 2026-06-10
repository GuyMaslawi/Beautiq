"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, Star } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  addClientReviewAction,
  deleteClientReviewAction,
  ReviewFormState,
} from "@/server/public-page/actions";
import type { ClientReviewData } from "@/server/public-page/queries";

const INITIAL: ReviewFormState = {};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className="h-5 w-5 transition-colors"
            fill={n <= value ? "#b86b8c" : "none"}
            stroke={n <= value ? "#b86b8c" : "#ccc"}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewsManager({
  reviews,
  addAction,
  deleteAction,
}: {
  reviews: ClientReviewData[];
  addAction: typeof addClientReviewAction;
  deleteAction: typeof deleteClientReviewAction;
}) {
  const [state, formAction, isAdding] = useActionState(addAction, INITIAL);
  const [rating, setRating] = useState(5);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      await deleteAction(id);
      setDeletingId(null);
    });
  };

  return (
    <div className="space-y-5">
      {/* Add form */}
      <form action={formAction} className="space-y-3" noValidate>
        {state.formError && <Alert>{state.formError}</Alert>}
        {state.success && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {state.success}
          </div>
        )}

        <Field
          label={PUBLIC_PAGE.reviews.clientNameLabel}
          htmlFor="clientName"
          error={state.errors?.clientName}
        >
          <Input
            id="clientName"
            name="clientName"
            placeholder={PUBLIC_PAGE.reviews.clientNamePlaceholder}
          />
        </Field>

        <Field
          label={PUBLIC_PAGE.reviews.reviewTextLabel}
          htmlFor="reviewText"
          error={state.errors?.reviewText}
        >
          <Textarea
            id="reviewText"
            name="reviewText"
            rows={3}
            placeholder={PUBLIC_PAGE.reviews.reviewTextPlaceholder}
          />
        </Field>

        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {PUBLIC_PAGE.reviews.ratingLabel}
          </p>
          <StarRating value={rating} onChange={setRating} />
          <input type="hidden" name="rating" value={rating} />
        </div>

        <Button type="submit" variant="secondary" size="sm" disabled={isAdding}>
          {isAdding ? PUBLIC_PAGE.reviews.adding : PUBLIC_PAGE.reviews.addButton}
        </Button>
      </form>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {PUBLIC_PAGE.reviews.emptyState}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-[var(--border)] bg-white p-4"
              style={{ boxShadow: "0 1px 4px rgba(43,37,48,0.05)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {review.clientName}
                    </span>
                    <div className="flex gap-0.5" dir="ltr">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5"
                          fill={i < review.rating ? "#b86b8c" : "none"}
                          stroke={i < review.rating ? "#b86b8c" : "#ddd"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {review.reviewText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(review.id)}
                  disabled={deletingId === review.id || isPending}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                  title={PUBLIC_PAGE.reviews.deleteButton}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
