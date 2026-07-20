-- Show reviews and gallery on the public booking page by default. The sections
-- still only render when real content exists, so this simply removes the extra
-- opt-in step and makes existing content visible without owner action.
ALTER TABLE "Business" ALTER COLUMN "showReviews" SET DEFAULT true;
ALTER TABLE "Business" ALTER COLUMN "showGallery" SET DEFAULT true;

-- Backfill existing businesses so the "everything is shown by default" rule
-- applies to accounts created before this change too.
UPDATE "Business" SET "showReviews" = true WHERE "showReviews" = false;
UPDATE "Business" SET "showGallery" = true WHERE "showGallery" = false;
