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
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">
          העבודות שלנו
        </h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          הצצה לתוצאות ולסגנון שלנו
        </p>
      </div>

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border)] bg-white px-6 py-12 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: `${brand}14`, color: brand }}
          >
            <Images className="h-7 w-7" />
          </div>
          <p className="text-base font-bold text-[var(--foreground)]">
            בקרוב יעלו עבודות לגלריה
          </p>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
            כאן יוצגו תמונות של עבודות ותוצאות מהסטודיו
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="aspect-square overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={img.caption ?? ""}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
