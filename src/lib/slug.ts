/**
 * Slug helpers for public business URLs.
 *
 * A slug is the lowercase, URL-safe identifier used in a business's public
 * address. We keep it ASCII-only so links are clean and predictable. Because
 * business names are usually Hebrew, slugify often cannot derive anything
 * meaningful — in that case it returns an empty string and the owner types one
 * in manually.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/**
 * Best-effort suggestion from a (possibly Hebrew) business name. Keeps only
 * ASCII letters/digits, collapses separators into single hyphens, and trims.
 * Returns "" when nothing usable remains.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** True when the slug is well-formed and within the allowed length range. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN_LENGTH &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}
