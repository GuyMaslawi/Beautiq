"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PUBLIC_PAGE } from "@/lib/constants/he";
import type {
  updateBrandingAction,
  BrandingFormState,
} from "@/server/public-page/actions";

const INITIAL: BrandingFormState = {};

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

function ImageUploadZone({
  label,
  hint,
  value,
  onChange,
  accept,
  aspectClass,
  inputId,
  uploading,
  onUpload,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  accept: string;
  aspectClass: string;
  inputId: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    await onUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        {label}
      </label>
      <p className="text-xs text-[var(--muted)]">{hint}</p>

      {value ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className={`w-full rounded-xl object-cover border border-[var(--border)] ${aspectClass}`}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-red-500 shadow-sm hover:bg-white transition-colors"
            title="הסרת תמונה"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm hover:bg-white transition-colors disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            החלפה
          </button>
        </div>
      ) : (
        <div
          className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-8 cursor-pointer hover:border-[#ac5c7f]/50 hover:bg-[#ac5c7f]/5 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ac5c7f] border-t-transparent" />
              <span className="text-sm text-[var(--muted)]">מעלה תמונה…</span>
            </div>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ac5c7f]/10">
                <ImageIcon className="h-6 w-6 text-[#ac5c7f]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  לחצי להעלאת תמונה
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  JPG, PNG, WEBP עד 10MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function BrandingForm({
  action,
  initialValues,
}: {
  action: typeof updateBrandingAction;
  initialValues: {
    logoUrl: string | null;
    coverImageUrl: string | null;
    brandColor: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, INITIAL);

  const [fields, setFields] = useState({
    logoUrl: initialValues.logoUrl ?? "",
    coverImageUrl: initialValues.coverImageUrl ?? "",
    brandColor: initialValues.brandColor ?? "#ac5c7f",
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleUpload = async (
    field: "logoUrl" | "coverImageUrl",
    file: File,
    setUploading: (v: boolean) => void
  ) => {
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setFields((prev) => ({ ...prev, [field]: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Hidden inputs carry the URLs to the server action */}
      <input type="hidden" name="logoUrl" value={fields.logoUrl} />
      <input type="hidden" name="coverImageUrl" value={fields.coverImageUrl} />

      {uploadError && <Alert>{uploadError}</Alert>}
      {state.formError && <Alert>{state.formError}</Alert>}
      {state.success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      {/* Logo upload */}
      <ImageUploadZone
        label={PUBLIC_PAGE.branding.logoLabel}
        hint={PUBLIC_PAGE.branding.logoHint}
        value={fields.logoUrl}
        onChange={(url) => setFields((prev) => ({ ...prev, logoUrl: url }))}
        accept="image/jpeg,image/png,image/webp"
        aspectClass="h-24 w-24 rounded-full"
        inputId="logo-upload"
        uploading={uploadingLogo}
        onUpload={(file) =>
          handleUpload("logoUrl", file, setUploadingLogo)
        }
      />

      {/* Cover image upload */}
      <ImageUploadZone
        label={PUBLIC_PAGE.branding.coverLabel}
        hint={PUBLIC_PAGE.branding.coverHint}
        value={fields.coverImageUrl}
        onChange={(url) =>
          setFields((prev) => ({ ...prev, coverImageUrl: url }))
        }
        accept="image/jpeg,image/png,image/webp"
        aspectClass="h-32"
        inputId="cover-upload"
        uploading={uploadingCover}
        onUpload={(file) =>
          handleUpload("coverImageUrl", file, setUploadingCover)
        }
      />

      {/* Brand color — compact */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          צבע מותג
        </label>
        <p className="text-xs text-[var(--muted)]">
          הצבע הראשי של עמוד הלקוחות (כפתורים, דגשים)
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            id="brandColor"
            name="brandColor"
            value={fields.brandColor}
            onChange={(e) =>
              setFields((prev) => ({ ...prev, brandColor: e.target.value }))
            }
            className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--border)] bg-white p-0.5"
          />
          <div
            className="h-8 w-8 rounded-lg border border-[var(--border)] shrink-0"
            style={{ background: fields.brandColor }}
          />
          <input
            type="text"
            value={fields.brandColor}
            onChange={(e) =>
              setFields((prev) => ({ ...prev, brandColor: e.target.value }))
            }
            className="w-28 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-mono"
            maxLength={7}
            dir="ltr"
          />
          <button
            type="button"
            onClick={() =>
              setFields((prev) => ({ ...prev, brandColor: "#ac5c7f" }))
            }
            className="text-xs text-[var(--muted)] underline hover:opacity-75"
          >
            ברירת מחדל
          </button>
        </div>
        {state.errors?.brandColor && (
          <p className="text-xs text-red-500">{state.errors.brandColor}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || uploadingLogo || uploadingCover}
        className="w-full"
      >
        {isPending ? PUBLIC_PAGE.branding.saving : PUBLIC_PAGE.branding.saveButton}
      </Button>
    </form>
  );
}
