import { Quote } from "lucide-react";
import type { PublicReview } from "@/server/public-booking/queries";
import { StarRow } from "./icons";
import { brandGradient } from "./helpers";

export function PublicReviewsSection({
  reviews,
  avgRating,
  brand,
}: {
  reviews: PublicReview[];
  avgRating: number;
  brand: string;
}) {
  const grd = brandGradient(brand);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Header row */}
      <div className="mb-5 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-end sm:justify-between sm:text-right">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">
            מה הלקוחות אומרות
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            חוויות אמיתיות של לקוחות מרוצות
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 shadow-sm">
          <span className="text-3xl font-bold leading-none" style={{ color: brand }}>
            {avgRating.toFixed(1)}
          </span>
          <div className="space-y-1 text-right">
            <StarRow rating={Math.round(avgRating)} size="md" />
            <p className="text-xs text-[var(--muted)]">
              מבוסס על {reviews.length} ביקורות
            </p>
          </div>
        </div>
      </div>

      {/* Cards — horizontal snap carousel on mobile, grid on larger screens */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {reviews.slice(0, 6).map((review) => (
          <div
            key={review.id}
            className="flex w-[80%] max-w-[300px] shrink-0 snap-center flex-col rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm sm:w-auto sm:max-w-none"
          >
              <Quote
                className="mb-3 h-7 w-7 shrink-0"
                style={{ color: `${brand}55` }}
              />
              <StarRow rating={review.rating} size="sm" />
              <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--foreground-soft)]">
                {review.reviewText}
              </p>
              <div className="mt-4 flex items-center gap-2.5 border-t border-[var(--border)] pt-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: grd }}
                >
                  {review.clientName.charAt(0)}
                </div>
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {review.clientName}
                </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
