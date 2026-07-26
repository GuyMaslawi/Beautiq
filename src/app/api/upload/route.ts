import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser, getCurrentBusiness } from "@/server/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";

/** The only image types we accept — verified from the file's magic bytes. */
type AllowedType = "image/jpeg" | "image/png" | "image/webp";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
/** Per-business upload quota — a logo/cover/gallery workflow needs nowhere near this. */
const UPLOAD_MAX_PER_WINDOW = 40;
const UPLOAD_WINDOW_MS = 60 * 60_000; // שעה

/**
 * Identify the real image type from the file's magic bytes.
 *
 * `file.type` is just the Content-Type the client wrote in the multipart part
 * header — it is not evidence of anything. Sniffing the actual bytes means the
 * blob store can never be used as a general-purpose file host for arbitrary
 * content smuggled behind an image label, and the contentType we persist always
 * matches what the file really is.
 */
function sniffImageType(head: Uint8Array): AllowedType | null {
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  // Same gate as requirePaidUser() + requireCurrentBusiness(), but written out so
  // this route answers with JSON status codes instead of a redirect — the browser
  // uploader reads `res.json()`, and a redirect would hand it an HTML page.
  //
  // The previous check only asked "is this user signed in and does she have a
  // business", so an unpaid or admin-suspended account could keep pushing
  // billable blobs into Vercel storage.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }
  const suspended =
    !user.isAdmin &&
    !user.impersonating &&
    !!user.suspendedUntil &&
    user.suspendedUntil.getTime() > Date.now();
  if (suspended) {
    return NextResponse.json({ error: "החשבון מושהה" }, { status: 403 });
  }
  if (!user.plan && !user.isAdmin && !user.impersonating) {
    return NextResponse.json({ error: "נדרש מנוי פעיל" }, { status: 403 });
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 403 });
  }
  const tenant = { businessId: business.id };

  // Quota keyed on the business, not the IP: the caller is authenticated here, so
  // this is the identity that actually matters and it cannot be rotated.
  if (
    !checkRateLimit(
      `upload:${tenant.businessId}`,
      UPLOAD_MAX_PER_WINDOW,
      UPLOAD_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { error: "הועלו יותר מדי קבצים. נסי שוב בעוד זמן קצר." },
      { status: 429 },
    );
  }

  // Reject an oversized body before buffering the whole multipart form.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SIZE + 8 * 1024) {
    return NextResponse.json(
      { error: "הקובץ גדול מדי. הגודל המקסימלי הוא 10MB." },
      { status: 413 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "הקובץ גדול מדי. הגודל המקסימלי הוא 10MB." },
      { status: 400 },
    );
  }

  // Trust the bytes, not the declared type.
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed) {
    return NextResponse.json(
      { error: "סוג קובץ לא נתמך. יש להעלות JPG, PNG או WEBP." },
      { status: 400 },
    );
  }

  const ext = sniffed.split("/")[1];
  const filename = `businesses/${tenant.businessId}/${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: sniffed,
  });

  return NextResponse.json({ url: blob.url });
}
