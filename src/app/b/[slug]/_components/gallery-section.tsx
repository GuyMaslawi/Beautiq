import { Images } from "lucide-react";
import type { PublicGalleryImage } from "@/server/public-booking/queries";

export function PublicGallerySection({
  images,
  brand,
}: {
  images: PublicGalleryImage[];
  brand: string;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="mb-6 text-center sm:text-right">
        <span className="eyebrow" style={{ color: brand }}>
          גלריה
        </span>
        <h2 className="text-foreground mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
          העבודות שלנו
        </h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">הצצה לתוצאות ולסגנון שלנו</p>
      </div>

      {images.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-[1.6rem] border border-dashed px-6 py-14 text-center"
          style={{ borderColor: "rgba(184,107,140,0.28)", background: "rgba(255,255,255,0.6)" }}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}aa)` }}>
            <Images className="h-7 w-7" />
          </div>
          <p className="text-foreground text-base font-bold">בקרוב יעלו עבודות לגלריה</p>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">כאן יוצגו תמונות של עבודות ותוצאות מהסטודיו</p>
        </div>
      ) : (
        <div className="grid auto-rows-[1fr] grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`group relative overflow-hidden rounded-[1.3rem] shadow-[0_10px_30px_-16px_rgba(124,58,97,0.25)] ${
                i === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-square"
              }`}
              style={{ border: "1px solid rgba(255,255,255,0.7)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={img.caption ?? ""}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `linear-gradient(to top, ${brand}55, transparent 60%)` }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
