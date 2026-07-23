-- A client who grabs an available slot is confirmed immediately — there is no
-- manual approval step. Both booking.create paths (public + owner) already write
-- status = 'approved' explicitly, so the old 'pending' default was never used.
-- Align the column default with reality so no path can ever produce a 'pending'
-- booking implicitly.
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'approved';
