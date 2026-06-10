"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, ImagePlus } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  addGalleryImageAction,
  deleteGalleryImageAction,
  GalleryFormState,
} from "@/server/public-page/actions";
import type { GalleryImageData } from "@/server/public-page/queries";

const INITIAL: GalleryFormState = {};

export function GalleryManager({
  images,
  addAction,
  deleteAction,
}: {
  images: GalleryImageData[];
  addAction: typeof addGalleryImageAction;
  deleteAction: typeof deleteGalleryImageAction;
}) {
  const [state, formAction, isAdding] = useActionState(addAction, INITIAL);
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
          label={PUBLIC_PAGE.gallery.imageUrlLabel}
          htmlFor="imageUrl"
          error={state.errors?.imageUrl}
        >
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            dir="ltr"
            placeholder={PUBLIC_PAGE.gallery.imageUrlPlaceholder}
          />
        </Field>

        <Field label={PUBLIC_PAGE.gallery.captionLabel} htmlFor="caption">
          <Input
            id="caption"
            name="caption"
            placeholder={PUBLIC_PAGE.gallery.captionPlaceholder}
          />
        </Field>

        <Button type="submit" variant="secondary" size="sm" disabled={isAdding}>
          <ImagePlus className="h-4 w-4" />
          {isAdding
            ? PUBLIC_PAGE.gallery.adding
            : PUBLIC_PAGE.gallery.addButton}
        </Button>
      </form>

      {/* Image grid */}
      {images.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {PUBLIC_PAGE.gallery.emptyState}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative rounded-xl overflow-hidden border border-[var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={img.caption ?? "תמונה"}
                className="h-28 w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3e8ef' width='100' height='100'/%3E%3C/svg%3E";
                }}
              />
              {img.caption && (
                <p className="px-2 py-1.5 text-xs text-[var(--muted)]">
                  {img.caption}
                </p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                disabled={deletingId === img.id || isPending}
                className="absolute top-1.5 left-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-red-600 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 disabled:opacity-50"
                title={PUBLIC_PAGE.gallery.deleteButton}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
