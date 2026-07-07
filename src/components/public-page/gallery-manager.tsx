"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, Upload, ImagePlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  addGalleryImageAction,
  deleteGalleryImageAction,
} from "@/server/public-page/actions";
import type { GalleryImageData } from "@/server/public-page/queries";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "שגיאה בהעלאת התמונה");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function GalleryManager({
  images,
  addAction,
  deleteAction,
}: {
  images: GalleryImageData[];
  addAction: typeof addGalleryImageAction;
  deleteAction: typeof deleteGalleryImageAction;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const url = await uploadImage(file);
        const fd = new FormData();
        fd.append("imageUrl", url);
        await addAction({}, fd);
        setUploadProgress({ done: i + 1, total: files.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה");
        break;
      }
    }

    setUploading(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      await deleteAction(id);
      setDeletingId(null);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}

      {/* Upload zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-8 cursor-pointer hover:border-[#ac5c7f]/50 hover:bg-[#ac5c7f]/5 transition-colors"
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ac5c7f] border-t-transparent" />
            {uploadProgress && (
              <span className="text-sm text-[var(--muted)]">
                מעלה {uploadProgress.done} מתוך {uploadProgress.total}…
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ac5c7f]/10">
              <Upload className="h-6 w-6 text-[#ac5c7f]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                לחצי להעלאת תמונות
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                ניתן לבחור מספר תמונות בבת אחת · JPG, PNG, WEBP עד 10MB לתמונה
              </p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--surface)] py-10 text-center">
          <ImagePlus className="h-8 w-8 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            {PUBLIC_PAGE.gallery.emptyState}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-xl overflow-hidden border border-[var(--border)]"
            >
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
