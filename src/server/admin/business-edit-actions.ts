"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { isValidIsraeliPhone } from "@/lib/phone";
import { isValidSlug, SLUG_MIN_LENGTH, SLUG_MAX_LENGTH } from "@/lib/slug";
import { isValidEmail } from "@/lib/validation/auth";

// ---------------------------------------------------------------------------
// Admin business / owner edit — platform-admin only, cross-tenant.
//
// Lets a platform admin edit every relevant Business detail (identity + public
// booking page) and the owner User account (name + login email) for any
// business. Owner edits are scoped to the single owner of THIS business — never
// an arbitrary user — so an admin can't accidentally overwrite an unrelated
// account. Email/slug uniqueness is validated to avoid login/URL conflicts.
// ---------------------------------------------------------------------------

export interface AdminUpdateBusinessState {
  success?: boolean;
  fieldErrors?: {
    name?: string;
    slug?: string;
    phone?: string;
    brandColor?: string;
  };
  formError?: string;
}

// Boolean visibility toggles on the public booking page. Each is submitted with
// the hidden "false" + checkbox "true" pattern, so we read the last value.
const VISIBILITY_FIELDS = [
  "showServices",
  "showPrices",
  "showHours",
  "showReviews",
  "showGallery",
  "showCancellationPolicy",
  "showPhone",
  "showAddress",
] as const;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readOptional(formData: FormData, key: string): string | null {
  const v = readText(formData, key);
  return v.length > 0 ? v : null;
}

export async function adminUpdateBusinessAction(
  businessId: string,
  _prevState: AdminUpdateBusinessState,
  formData: FormData,
): Promise<AdminUpdateBusinessState> {
  await requirePlatformAdmin();

  const existing = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, slug: true },
  });
  if (!existing) return { formError: "העסק לא נמצא" };

  const name = readText(formData, "name");
  const slug = readText(formData, "slug").toLowerCase();
  const phone = readText(formData, "phone");

  const fieldErrors: NonNullable<AdminUpdateBusinessState["fieldErrors"]> = {};

  if (!name) fieldErrors.name = "יש למלא שם עסק";

  if (!slug) {
    fieldErrors.slug = "יש למלא כתובת קישור";
  } else if (!isValidSlug(slug)) {
    fieldErrors.slug = `הקישור חייב להכיל ${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} תווים באנגלית, ספרות ומקפים בלבד`;
  }

  if (phone && !isValidIsraeliPhone(phone)) {
    fieldErrors.phone = "מספר הטלפון לא נראה תקין";
  }

  const brandColor = readOptional(formData, "brandColor");
  if (brandColor && !HEX_COLOR_PATTERN.test(brandColor)) {
    fieldErrors.brandColor = "צבע לא תקין — יש להזין קוד צבע כמו ‎#RRGGBB";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Slug uniqueness — only when it actually changed, scoped to other businesses.
  if (slug !== existing.slug) {
    const slugOwner = await prisma.business.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== businessId) {
      return { fieldErrors: { slug: "כתובת הקישור כבר תפוסה על ידי עסק אחר" } };
    }
  }

  const visibility = Object.fromEntries(
    VISIBILITY_FIELDS.map((f) => [f, formData.getAll(f).includes("true")]),
  ) as Record<(typeof VISIBILITY_FIELDS)[number], boolean>;

  const timezone = readText(formData, "timezone") || "Asia/Jerusalem";

  try {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        name,
        slug,
        phone: phone || null,
        description: readOptional(formData, "description"),
        timezone,
        city: readOptional(formData, "city"),
        area: readOptional(formData, "area"),
        addressNote: readOptional(formData, "addressNote"),
        logoUrl: readOptional(formData, "logoUrl"),
        coverImageUrl: readOptional(formData, "coverImageUrl"),
        instagramUrl: readOptional(formData, "instagramUrl"),
        facebookUrl: readOptional(formData, "facebookUrl"),
        brandColor,
        introMessage: readOptional(formData, "introMessage"),
        ...visibility,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { fieldErrors: { slug: "כתובת הקישור כבר תפוסה על ידי עסק אחר" } };
    }
    return { formError: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  // Reflect the change in the admin views, the owner's own pages, and the
  // public booking page (the slug may have changed).
  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");
  revalidatePath("/settings");
  revalidatePath(`/b/${existing.slug}`);
  revalidatePath(`/b/${slug}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Owner account edit (name + login email).
// ---------------------------------------------------------------------------

export interface AdminUpdateOwnerState {
  success?: boolean;
  fieldErrors?: {
    name?: string;
    email?: string;
  };
  formError?: string;
}

export async function adminUpdateOwnerAction(
  businessId: string,
  _prevState: AdminUpdateOwnerState,
  formData: FormData,
): Promise<AdminUpdateOwnerState> {
  await requirePlatformAdmin();

  // Resolve THIS business's owner — never an arbitrary user id from the client.
  const membership = await prisma.businessUser.findFirst({
    where: { businessId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, email: true } } },
  });

  const owner = membership?.user;
  if (!owner) return { formError: "לא נמצא בעלים לעסק זה" };

  const name = readText(formData, "name");
  const email = readText(formData, "email").toLowerCase();

  const fieldErrors: NonNullable<AdminUpdateOwnerState["fieldErrors"]> = {};

  if (!email) {
    fieldErrors.email = "יש למלא אימייל";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "כתובת האימייל לא נראית תקינה";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // Email is the login identity — block creating a duplicate-login conflict.
  if (email !== owner.email.toLowerCase()) {
    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== owner.id) {
      return { fieldErrors: { email: "כתובת האימייל כבר רשומה במערכת" } };
    }
  }

  try {
    await prisma.user.update({
      where: { id: owner.id },
      data: { name: name || null, email },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { fieldErrors: { email: "כתובת האימייל כבר רשומה במערכת" } };
    }
    return { formError: "משהו השתבש. יש לנסות שוב בעוד רגע" };
  }

  revalidatePath(`/admin/businesses/${businessId}`);
  revalidatePath("/admin/businesses");

  return { success: true };
}
