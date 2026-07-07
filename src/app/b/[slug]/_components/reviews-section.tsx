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
  const shown = reviews.slice(0, 6);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Header row */}
      <div className="mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:justify-between sm:text-right">
        <div>
          <span className="eyebrow" style={{ color: brand }}>
            ביקורות
          </span>
          <h2 className="text-foreground mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
            מה הלקוחות אומרות
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">חוויות אמיתיות של לקוחות מרוצות</p>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-3"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.8))",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 10px 28px -14px rgba(124,58,97,0.2)",
          }}
        >
          <span className="display-num text-4xl font-bold leading-none" style={{ color: brand }}>
            {avgRating.toFixed(1)}
          </span>
          <div className="space-y-1 text-right">
            <StarRow rating={Math.round(avgRating)} size="md" />
            <p className="text-xs text-[var(--muted)]">מבוסס על {reviews.length} ביקורות</p>
          </div>
        </div>
      </div>

      {/* Mobile: snap carousel · Desktop: editorial masonry wall */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:pb-0 sm:[display:block] sm:columns-2 sm:gap-5 lg:columns-3">
        {shown.map((review, i) => (
          <div
            key={review.id}
            className="lift flex w-[82%] max-w-[320px] shrink-0 snap-center flex-col rounded-[1.5rem] p-6 sm:mb-5 sm:inline-flex sm:w-full sm:max-w-none sm:break-inside-avoid"
            style={{
              background: i === 0
                ? `linear-gradient(160deg, ${brand}12 0%, rgba(255,255,255,0.92) 60%)`
                : "linear-gradient(165deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.84) 100%)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "0 12px 32px -16px rgba(124,58,97,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            <Quote className="mb-3 h-8 w-8 shrink-0" style={{ color: `${brand}66` }} />
            <StarRow rating={review.rating} size="sm" />
            <p className="text-foreground-soft mt-3 flex-1 text-sm leading-relaxed">{review.reviewText}</p>
            <div className="mt-5 flex items-center gap-2.5 border-t pt-4" style={{ borderColor: "rgba(172,92,127,0.14)" }}>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: grd }}
              >
                {review.clientName.charAt(0)}
              </div>
              <span className="text-foreground text-sm font-semibold">{review.clientName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
