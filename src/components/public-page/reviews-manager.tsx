"use client";

import { useState, useTransition } from "react";
import { Trash2, Star } from "lucide-react";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type { deleteClientReviewAction } from "@/server/public-page/actions";
import type { ClientReviewData } from "@/server/public-page/queries";

export function ReviewsManager({
  reviews,
  deleteAction,
}: {
  reviews: ClientReviewData[];
  deleteAction: typeof deleteClientReviewAction;
}) {
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
      {/* Info notice */}
      <div className="rounded-xl border border-[#e8d5e0] bg-[#fdf6fa] px-4 py-3 text-sm text-[var(--muted)]">
        ביקורות יתווספו על ידי לקוחות דרך עמוד הלקוחות הציבורי.
      </div>

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
              className="rounded-xl border border-[var(--border)] bg-surface p-4"
              style={{ boxShadow: "0 1px 4px rgba(43,37,48,0.05)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {review.clientName}
                    </span>
                    <div className="flex gap-0.5" dir="ltr">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5"
                          fill={i < review.rating ? "#ac5c7f" : "none"}
                          stroke={i < review.rating ? "#ac5c7f" : "#ddd"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--muted)]">
                    {review.reviewText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(review.id)}
                  disabled={deletingId === review.id || isPending}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
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
